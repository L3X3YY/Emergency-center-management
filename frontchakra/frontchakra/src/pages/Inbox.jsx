// src/pages/Inbox.jsx
import { useEffect, useRef, useState } from "react";
import {
  Box, Button, Divider, Flex, Heading, Input, List, ListItem, Text, Textarea, useToast, VStack,
  HStack, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Select, Badge, useColorModeValue
} from "@chakra-ui/react";
import { AddIcon } from "@chakra-ui/icons";
import { api } from "../api";
import { useAuth } from "../auth";
import { Tooltip } from "@chakra-ui/react";



// ----- small polling hook -----
function useInterval(callback, delay, enabled = true) {
  const savedCb = useRef(callback);
  useEffect(() => { savedCb.current = callback; }, [callback]);
  useEffect(() => {
    if (!enabled || delay == null) return;
    const id = setInterval(() => savedCb.current(), delay);
    return () => clearInterval(id);
  }, [delay, enabled]);
}

function isSystemConv(id) { return id?.startsWith("system_"); }
function isDmConv(id) { return id?.startsWith("dm_"); }
function dmOtherId(convId, myId) {
  const parts = convId.replace(/^dm_/, "").split("_");
  return parts.find((p) => p !== myId) || parts[0];
}
function fmtTime(ts) { try { return new Date(ts).toLocaleString(); } catch { return ""; } }

// Helpers to render names now that we have first_name/last_name
function fullName(u) {
  return [u?.first_name, u?.last_name].filter(Boolean).join(" ").trim();
}

export default function Inbox() {
  const toast = useToast();
  const { me } = useAuth();

  // ---- color mode aware tokens ----
  const panelBg        = useColorModeValue("white", "gray.800");
  const borderCol      = useColorModeValue("gray.200", "gray.700");
  const listDividerCol = useColorModeValue("gray.100", "gray.700");
  const mainBg         = useColorModeValue("gray.50", "gray.900");
  const mutedText      = useColorModeValue("gray.600", "gray.400");
  const mutedTextSm    = useColorModeValue("gray.500", "gray.500");
  const activeRowBg    = useColorModeValue("blue.50", "blue.900");

  const bubbleMineBg      = useColorModeValue("blue.100", "blue.900");
  const bubbleMineBorder  = useColorModeValue("blue.200", "blue.700");
  const bubbleOtherBg     = useColorModeValue("gray.100", "gray.700");
  const bubbleOtherBorder = useColorModeValue("gray.200", "gray.600");
  const bubbleSystemBg    = useColorModeValue("gray.200", "gray.600");
  const bubbleSystemBorder= useColorModeValue("gray.300", "gray.500");

  // directory for names
  const [centers, setCenters] = useState([]);
  const [userMap, setUserMap] = useState({}); // { user_id: { first_name, last_name, email } }

  // conversations + active thread
  const [conversations, setConversations] = useState([]);
  const [active, setActive] = useState(null);
  const [messages, setMessages] = useState([]);

  // show loaders only on first load
  const [initialConvosLoaded, setInitialConvosLoaded] = useState(false);
  const [initialMsgsLoaded,   setInitialMsgsLoaded]   = useState(false);

  // composer
  const [draft, setDraft] = useState("");

  // new message modal
  const [newOpen, setNewOpen] = useState(false);
  const [selCenter, setSelCenter] = useState("");
  const [recipients, setRecipients] = useState([]);
  const [selRecipient, setSelRecipient] = useState("");
  const [newBody, setNewBody] = useState("");
  const [sendingNew, setSendingNew] = useState(false);

  // scroll anchor (keeps scroll at bottom when new messages come in)
  const scrollRef = useRef(null);
  const scrollToBottom = () => {
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  };

  // ---------- directory (once) ----------
  useEffect(() => {
    (async () => {
      try {
        const c = await api.centersList();
        setCenters(c.centers || []);
        const map = {};
        for (const center of c.centers || []) {
          try {
            const m = await api.centerMembers(center._id);
            (m.members || []).forEach(u => {
              map[u.user_id] = map[u.user_id] || {
                first_name: u.first_name,
                last_name: u.last_name,
                email: u.email
              };
            });
          } catch { /* ignore per-center errors */ }
        }
        setUserMap(map);
      } catch (e) {
        toast({ status: "error", title: e.message });
      }
    })();
  }, []);

  // ---------- initial loads ----------
  const loadConvos = async ({ silent = false } = {}) => {
  try {
    const data = await api.conversations();
    const convs = data.conversations || [];
    setConversations(convs);

    // pick first active if none
    if (!active && convs?.[0]?.conversation_id) {
      setActive(convs[0].conversation_id);
    }

    // ---- NEW: enrich userMap with DM peers (e.g., admins) ----
    const dmPeerIds = new Set();
    for (const c of convs) {
      if (isDmConv(c.conversation_id)) {
        const other = dmOtherId(c.conversation_id, me.id);
        if (other && !userMap[other]) dmPeerIds.add(other);
      }
    }

    if (dmPeerIds.size) {
      try {
        const resp = await api.usersBasics(Array.from(dmPeerIds));
        const got = resp.users || [];
        if (got.length) {
          setUserMap(prev => {
            const next = { ...prev };
            for (const u of got) {
              next[u.id] = {
                first_name: u.first_name,
                last_name: u.last_name,
                email: u.email,
                global_role: u.global_role,
              };
            }
            return next;
          });
        }
      } catch (e) {
        // non-fatal: just means names may show as ids
        if (!silent) console.warn("usersBasics failed:", e?.message || e);
      }
    }
  } catch (e) {
    if (!silent) toast({ status: "error", title: e.message });
  } finally {
    if (!initialConvosLoaded) setInitialConvosLoaded(true);
  }
};


  const loadMessages = async (cid, { silent = false } = {}) => {
    if (!cid) return;
    try {
      const data = await api.messagesGet(cid);
      setMessages(data.messages || []);
      if (!silent) setTimeout(scrollToBottom, 0);
    } catch (e) {
      if (!silent) toast({ status: "error", title: e.message });
    } finally {
      if (!initialMsgsLoaded) setInitialMsgsLoaded(true);
    }
  };

  useEffect(() => { loadConvos({ silent: false }); }, []);
  useEffect(() => { if (active) loadMessages(active, { silent: false }); }, [active]);

  // ---------- silent polling (no spinners) ----------
  useInterval(() => { loadConvos({ silent: true }); }, 1000, true);
  useInterval(() => { if (active) loadMessages(active, { silent: true }); }, 1000, !!active);

  // ---------- labels ----------
  const displayForUserId = (userId) => {
    const u = userMap[userId];
    return fullName(u) || u?.email || userId;
  };

  const convLabel = (c) => {
    if (isSystemConv(c.conversation_id)) return "System";
    if (isDmConv(c.conversation_id)) {
      const other = dmOtherId(c.conversation_id, me.id);
      return displayForUserId(other);
    }
    return c.conversation_id;
  };

  // ---------- send ----------
  const send = async () => {
    const content = draft.trim();
    if (!content || !active) return;

    if (isSystemConv(active)) {
      toast({ status: "warning", title: "Nu puteti raspunde la acest mesaj" });
      return;
    }
    const toUser = dmOtherId(active, me.id);
    if (!toUser || toUser === "system") {
      toast({ status: "error", title: "Invalid recipient." });
      return;
    }

    try {
      // optimistic append
      const optimistic = {
        _id: `tmp_${Date.now()}`,
        conversation_id: active,
        from: me.id,
        to: toUser,
        content,
        timestamp: new Date().toISOString(),
        system: false,
      };
      setMessages(prev => [...prev, optimistic]);
      setDraft("");
      setTimeout(scrollToBottom, 0);

      await api.messageSend(toUser, content);
      // background refresh silently
      loadMessages(active, { silent: true });
      loadConvos({ silent: true });
    } catch (e) {
      toast({ status: "error", title: e.message });
    }
  };

  // ---------- new message ----------
  const openNew = () => { setSelCenter(""); setRecipients([]); setSelRecipient(""); setNewBody(""); setNewOpen(true); };
  const closeNew = () => setNewOpen(false);

  const onPickCenter = async (centerId) => {
    setSelCenter(centerId);
    setSelRecipient("");
    setNewBody("");
    if (!centerId) return setRecipients([]);
    try {
      const m = await api.centerMembers(centerId);
      const list = (m.members || []).filter(u => u.user_id !== me.id);
      setRecipients(list);
    } catch {}
  };

  const sendNew = async () => {
    if (!selRecipient) return toast({ status: "warning", title: "Pick a recipient" });
    if (!newBody.trim()) return toast({ status: "warning", title: "Scrieti un mesaj" });
    setSendingNew(true);
    try {
      await api.messageSend(selRecipient, newBody.trim());
      closeNew();
      const ids = [me.id, selRecipient].sort();
      const convId = `dm_${ids[0]}_${ids[1]}`;
      setActive(convId);
      // refresh silently
      await loadConvos({ silent: true });
      await loadMessages(convId, { silent: true });
      setTimeout(scrollToBottom, 0);
    } catch (e) {
      toast({ status: "error", title: e.message });
    } finally {
      setSendingNew(false);
    }
  };

  const composerDisabled = isSystemConv(active);

  return (
    <Flex minH="520px" h="70vh" gap={4} bg={mainBg}>
      {/* Left: Conversations */}
      <Box
        w="320px"
        border="1px"
        borderColor={borderCol}
        rounded="md"
        bg={panelBg}
        overflow="hidden"
        display="flex"
        flexDir="column"
      >
        <HStack p={3} borderBottom="1px" borderColor={borderCol}>
          <Heading size="sm">Conversatii</Heading>
          <Button size="sm" leftIcon={<AddIcon />} ml="auto" onClick={openNew}>
            Mesaj Nou
          </Button>
        </HStack>

        {/* Make the list area scroll within the fixed-height column */}
        <Box flex="1" minH={0} overflow="auto">
          {!initialConvosLoaded && conversations.length === 0 ? (
            <Text p={3} color={mutedText}>Loading…</Text>
          ) : conversations.length ? (
            <List>
              {conversations.map(c => (
                <ListItem
                  key={c.conversation_id}
                  p={3}
                  borderBottom="1px solid"
                  borderColor={listDividerCol}
                  bg={c.conversation_id === active ? activeRowBg : "transparent"}
                  cursor="pointer"
                  onClick={() => setActive(c.conversation_id)}
                >
                  <HStack justify="space-between">
                    <Text fontWeight="semibold">{convLabel(c)}</Text>
                    <Text fontSize="xs" color={mutedTextSm}>{fmtTime(c.timestamp)}</Text>
                  </HStack>
                  <Text fontSize="sm" color={mutedText} noOfLines={1}>{c.last_message}</Text>
                  {isSystemConv(c.conversation_id) && <Badge mt={1}>System</Badge>}
                </ListItem>
              ))}
            </List>
          ) : (
            <Text p={3}>No conversations yet</Text>
          )}
        </Box>
      </Box>

      {/* Right: Messages */}
      <Flex
        flex="1"
        direction="column"
        border="1px"
        borderColor={borderCol}
        rounded="md"
        bg={panelBg}
        overflow="hidden"   // contain inner scroll areas
      >
        <HStack p={3} borderBottom="1px" borderColor={borderCol}>
          <Heading size="sm">Mesaje</Heading>
          {composerDisabled && <Badge ml={2} colorScheme="gray">System</Badge>}
        </HStack>

        {/* Scrolls inside, header/footer stay fixed */}
        <VStack
  ref={scrollRef}
  align="stretch"
  spacing={2}
  flex="1"
  minH={0}
  p={3}
  overflowY="auto"
>
  {!initialMsgsLoaded && !messages.length && active ? (
    <Text color={mutedText}>Loading…</Text>
  ) : active ? (
    messages.map((m, idx) => {
      const isMine = typeof m.from === "string" && m.from === me.id;
      const isSystem = m.system || m.from === "system";
      const bg = isSystem ? bubbleSystemBg : (isMine ? bubbleMineBg : bubbleOtherBg);
      const bc = isSystem ? bubbleSystemBorder : (isMine ? bubbleMineBorder : bubbleOtherBorder);

      // ---- DATE SEPARATOR ----
      const curDate = new Date(m.timestamp).toLocaleDateString();
      const prevDate =
        idx > 0 ? new Date(messages[idx - 1].timestamp).toLocaleDateString() : null;
      const showDate = curDate !== prevDate;

       const timeLabel = new Date(m.timestamp).toLocaleTimeString([], {
        day: "2-digit",
        month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

      return (
        <Box key={m._id}>
          {showDate && (
            <Text
              fontSize="xs"
              textAlign="center"
              my={2}
              color={mutedText}
            >
              {curDate}
            </Text>
          )}
          <Box
            display="flex"
            justifyContent={isSystem ? "center" : (isMine ? "flex-end" : "flex-start")}
          >
            <Tooltip label={timeLabel} hasArrow placement="top">
            <Box
              display="inline-block"
              maxW="70%"
              whiteSpace="pre-wrap"
              wordBreak="normal"
              overflowWrap="break-word"
              px={3}
              py={2}
              rounded="md"
              bg={bg}
              border="1px solid"
              borderColor={bc}
            >
              <Text m={0} fontSize="sm">{m.content}</Text>
            </Box>
            </Tooltip>
          </Box>
        </Box>
      );
    })
  ) : (
    <Text color={mutedText}>Select a conversation</Text>
  )}
</VStack>


        <Divider borderColor={borderCol} />
        <Flex p={3} gap={2}>
          <Textarea
            value={draft}
            onChange={(e)=>setDraft(e.target.value)}
            placeholder={composerDisabled ? "Nu poti raspunde aici" : "Scrieti un mesaj"}
            rows={2}
            isDisabled={composerDisabled || !active}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); }
            }}
          />
          <Button onClick={send} colorScheme="blue" isDisabled={composerDisabled || !active}>
            Trimite
          </Button>
        </Flex>
      </Flex>

      {/* New Message Modal */}
      <Modal isOpen={newOpen} onClose={closeNew} isCentered>
        <ModalOverlay />
        <ModalContent bg={panelBg}>
          <ModalHeader>New Message</ModalHeader>
          <ModalBody>
            <Text mb={2} fontSize="sm" color={mutedText}>Pick a center, then a recipient from that center.</Text>
            <Select placeholder="Alege centru" value={selCenter} onChange={(e)=>onPickCenter(e.target.value)} mb={3}>
              {centers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </Select>
            <Select
              placeholder="Alege utilizatorul"
              value={selRecipient}
              onChange={(e)=>setSelRecipient(e.target.value)}
              mb={3}
              isDisabled={!selCenter}
            >
              {recipients.map(u => {
                const name = fullName(u) || u.email || u.user_id;
                return (
                  <option key={u.user_id} value={u.user_id}>
                    {name}
                  </option>
                );
              })}
            </Select>
            <Textarea
              placeholder="Scrie mesajul…"
              rows={4}
              value={newBody}
              onChange={(e)=>setNewBody(e.target.value)}
              isDisabled={!selRecipient}
            />
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={closeNew}>Anuleaza</Button>
            <Button colorScheme="blue" onClick={sendNew} isLoading={sendingNew} isDisabled={!selRecipient || !newBody.trim()}>
              Trimite
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Flex>
  );
}
