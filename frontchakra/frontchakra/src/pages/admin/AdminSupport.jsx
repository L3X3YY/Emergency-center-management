import { useEffect, useMemo, useState } from "react";
import {
  Badge, Box, Button, Heading, HStack, Input, Select, Table, Tbody, Td, Th, Thead, Tr,
  useToast, useDisclosure, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Text, useColorModeValue, Spacer
} from "@chakra-ui/react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api";

function fmt(ts) {
  try { return new Date(ts).toLocaleString(); } catch { return ""; }
}



export default function AdminSupport() {
  const toast = useToast();
  const nav = useNavigate();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [resolvedFilter, setResolvedFilter] = useState(""); // "", "true", "false"
  const [q, setQ] = useState("");

  const panelBg   = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");
  const headBg    = useColorModeValue("gray.50", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  const [openItem, setOpenItem] = useState(null);
  const dlg = useDisclosure();
  const [sendingTo, setSendingTo] = useState(null); // track which row is sending
    const sendQuickMsg = async (userId) => {
    if (!userId) return;
    setSendingTo(userId);
    try {
      await api.messageSend(
        userId,
        "Un administrator se ocupa acum de problema dumneavoastră"
      );
      toast({ status: "success", title: "Mesaj trimis" });

      // Go to Inbox and open that DM (no prefill).
      nav("/inbox", { state: { openDmUserId: userId } });
    } catch (e) {
      toast({ status: "error", title: e.message || "Eroare la trimitere" });
    } finally {
      setSendingTo(null);
    }
  };

  

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.adminSupportList(
        resolvedFilter ? { resolved: resolvedFilter } : {}
      );
      setRows(data.items || []);
    } catch (e) {
      toast({ status: "error", title: e.message || "Failed to load support messages" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [resolvedFilter]);

  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return rows;
    return rows.filter(r =>
      (r.email || "").toLowerCase().includes(s) ||
      (r.message || "").toLowerCase().includes(s)
    );
  }, [rows, q]);

  const toggleResolved = async (item, next) => {
    try {
      await api.adminSupportSetResolved(item.id, next);
      toast({ status: "success", title: next ? "Marcat ca rezolvat" : "Marcat ca nerezolvat" });
      if (openItem) setOpenItem({ ...openItem, resolved: next });
      await load();
    } catch (e) {
      toast({ status: "error", title: e.message });
    }
  };

  const openChat = (item) => {
    // Pass the target user id to Inbox so it opens the DM thread
    nav("/inbox", { state: { openDmUserId: item.user_id } });
  };

  return (
    <Box>
      <HStack mb={3} spacing={3}>
        <Heading size="md">Admin • Support</Heading>
        <Spacer />
        <Select
          maxW="180px"
          value={resolvedFilter}
          onChange={(e)=>setResolvedFilter(e.target.value)}
          title="Filter by status"
        >
          <option value="">Toate</option>
          <option value="false">Nerezolvate</option>
          <option value="true">Rezolvate</option>
        </Select>
        <Input
          maxW="320px"
          placeholder="Cauta email sau mesaj…"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
        />
        <Button onClick={load} isLoading={loading}>Refresh</Button>
      </HStack>

      <Box bg={panelBg} border="1px" borderColor={borderCol} rounded="md" overflow="hidden">
        <Table size="sm">
          <Thead bg={headBg}>
            <Tr>
              <Th>Data</Th>
              <Th>Email</Th>
              <Th>Mesaj</Th>
              <Th>Status</Th>
              <Th width="1%">Actiuni</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map((r) => (
              <Tr key={r.id}>
                <Td>{fmt(r.created_at)}</Td>
                <Td>{r.email || (r.user_id ? "(logged-in user)" : "—")}</Td>
                <Td>
                  <Button variant="link" onClick={()=>{ setOpenItem(r); dlg.onOpen(); }}>
                    {r.message?.slice(0, 60) || "—"}{(r.message || "").length > 60 ? "…" : ""}
                  </Button>
                </Td>
                <Td>
                  <Badge colorScheme={r.resolved ? "green" : "yellow"}>
                    {r.resolved ? "rezolvat" : "nerezolvat"}
                  </Badge>
                </Td>
                <Td>
                  <HStack spacing={2}>
                    <Button
                      size="xs"
                      colorScheme={r.resolved ? "yellow" : "green"}
                      onClick={()=>toggleResolved(r, !r.resolved)}
                    >
                      {r.resolved ? "Marcheaza nerezolvat" : "Marcheaza rezolvat"}
                    </Button>
                    {r.user_id && (
                      <Button size="xs" variant="outline" onClick={()=>sendQuickMsg(r.user_id)}>
                        Trimite mesaj
                      </Button>
                    )}
                  </HStack>
                </Td>
              </Tr>
            ))}
            {!loading && filtered.length === 0 && (
              <Tr><Td colSpan={5}><Text py={2} color={mutedText}>No messages.</Text></Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      {/* View modal */}
      <Modal isOpen={dlg.isOpen} onClose={dlg.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Support message</ModalHeader>
          <ModalBody>
            {openItem && (
              <>
                <Text fontSize="sm" color={mutedText} mb={2}>
                  {fmt(openItem.created_at)} • {openItem.email || (openItem.user_id ? `(logged-in user ${openItem.user_id})` : "anonymous")}
                </Text>
                <Text whiteSpace="pre-wrap">{openItem.message}</Text>
              </>
            )}
          </ModalBody>
          <ModalFooter>
            {openItem?.user_id && (
              <Button mr={3} variant="outline" onClick={()=>openChat(openItem)}>
                Send Message
              </Button>
            )}
            <Button
              colorScheme={openItem?.resolved ? "yellow" : "green"}
              onClick={()=>toggleResolved(openItem, !openItem?.resolved)}
            >
              {openItem?.resolved ? "Mark Unresolved" : "Mark Resolved"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
