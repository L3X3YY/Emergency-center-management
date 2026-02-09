// src/pages/Home.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Heading, Text, VStack, HStack, Spinner, Button, useColorModeValue,
  Stack, Textarea, useToast
} from "@chakra-ui/react";
import { NavLink as RRLink } from "react-router-dom";
import { useAuth } from "../auth";
import { api } from "../api";

function yyyymm(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function prettyDate(isoYmd){
  try {
    const [y,m,d] = isoYmd.split("-").map(Number);
    const dt = new Date(y, m-1, d);
    return dt.toLocaleDateString(ro-Ro, { weekday:"short", year:"numeric", month:"short", day:"numeric" });
  } catch { return isoYmd; }
}

export default function Home() {
  const { me } = useAuth();
  const toast = useToast();

  // light/dark tokens
  const panelBg   = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");
  const muted     = useColorModeValue("gray.600", "gray.400");

  // next shift
  const [loadingShift, setLoadingShift] = useState(true);
  const [nextShift, setNextShift] = useState(null);

  // centers
  const [loadingCenters, setLoadingCenters] = useState(true);
  const [centers, setCenters] = useState([]);

  // support
  const [supportMsg, setSupportMsg] = useState("");
  const [supportEmail, setSupportEmail] = useState("");
  const [sending, setSending] = useState(false);

  const todayYmd = useMemo(() => {
    const t = new Date();
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const now = new Date();
        const thisMonth = yyyymm(now);
        const nextMonth = yyyymm(new Date(now.getFullYear(), now.getMonth()+1, 1));
        const [a, b] = await Promise.all([
          api.mySchedule(thisMonth),
          api.mySchedule(nextMonth),
        ]);
        const all = [...(a.days || []), ...(b.days || [])]
          .filter(d => typeof d.date === "string")
          .sort((x,y) => x.date.localeCompare(y.date));
        const upcoming = all.find(d => d.date >= todayYmd) || null;
        setNextShift(upcoming);
      } catch {
        setNextShift(null);
      } finally {
        setLoadingShift(false);
      }
    })();

    (async () => {
      try {
        const res = await api.centersList();
        setCenters(res.centers || []);
      } catch {
        setCenters([]);
      } finally {
        setLoadingCenters(false);
      }
    })();
  }, [todayYmd]);

  const sendSupport = async () => {
  const body = supportMsg.trim();
  if (!body) {
    toast({ status: "warning", title: "Please type a message before sending" });
    return;
  }
  if (!me && !supportEmail.trim()) {
    toast({ status: "warning", title: "Please provide an email so we can reach you" });
    return;
  }
  setSending(true);
  try {
    await api.supportMessage({ message: body, email: me ? undefined : supportEmail.trim() });
    setSupportMsg("");
    if (!me) setSupportEmail("");
    toast({ status: "success", title: "Message sent to support" });
  } catch (e) {
    toast({ status: "error", title: e.message || "Failed to send" });
  } finally {
    setSending(false);
  }
};

  return (
    <VStack align="start" spacing={4}>
      <Heading size="md">Bun venit{me ? `, Dr. ${me.last_name}` : ""}</Heading>

      {/* Next shift card */}
      <Box w="full" maxW="lg" bg={panelBg} border="1px" borderColor={borderCol} rounded="md" p={4}>
        <HStack justify="space-between" mb={1}>
          <Heading size="sm">Urmatoare tura programata</Heading>
          <Button as={RRLink} to="/my-calendar" size="sm" variant="outline" colorScheme="blue">
            Vedeti calendar
          </Button>
        </HStack>
        {loadingShift ? (
          <HStack mt={2}><Spinner size="sm" /><Text color={muted}>Loading…</Text></HStack>
        ) : nextShift ? (
          <VStack align="start" spacing={0} mt={1}>
            <Text fontSize="lg" fontWeight="semibold">{prettyDate(nextShift.date)}</Text>
            <Text color={muted}>{nextShift.center_name || "Center"}</Text>
          </VStack>
        ) : (
          <Text mt={1} color={muted}>Zero programari viitoare gasite.</Text>
        )}
      </Box>

      {/* Centers card */}
      <Box w="full" maxW="lg" bg={panelBg} border="1px" borderColor={borderCol} rounded="md" p={4}>
        <HStack justify="space-between" mb={2}>
          <Heading size="sm">
            Faceti parte din {loadingCenters ? "…" : centers.length} {centers.length === 1 ? "centru" : "centre"}
          </Heading>
          <Button as={RRLink} to="/centers" size="sm" variant="outline" colorScheme="blue">
            Vedeti Centre
          </Button>
        </HStack>
        {loadingCenters ? (
          <HStack><Spinner size="sm" /><Text color={muted}>Incarca centre...</Text></HStack>
        ) : centers.length ? (
          <Stack spacing={2}>
            {centers.map(c => (
              <HStack
                key={c._id}
                justify="space-between"
                border="1px"
                borderColor={borderCol}
                rounded="md"
                px={3}
                py={2}
              >
                <Text>{c.name}</Text>
              </HStack>
            ))}
          </Stack>
        ) : (
          <Text color={muted}>You don’t belong to any centers yet.</Text>
        )}
      </Box>

      {/* Support card */}
      <Box w="full" maxW="lg" bg={panelBg} border="1px" borderColor={borderCol} rounded="md" p={4}>
        <Heading size="sm" mb={2}>Aveti orice problema?</Heading>
        <Text mb={2} color={muted}>Contact admin:</Text>
        <Textarea
          value={supportMsg}
          onChange={(e) => setSupportMsg(e.target.value)}
          placeholder="Mesajul dumneavostra"
          rows={4}
          mb={3}
        />
        <Button onClick={sendSupport} colorScheme="blue" isLoading={sending}>
          Trimite
        </Button>
      </Box>
    </VStack>
  );
}
