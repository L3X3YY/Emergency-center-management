// src/pages/Centers.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, HStack, Heading, Select, Spinner, Text, useDisclosure, useToast,
  Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel,
  Tabs, TabList, Tab, TabPanels, TabPanel, Table, Thead, Tbody, Tr, Th, Td, Input, IconButton, Badge,
  useColorModeValue,
} from "@chakra-ui/react";
import { DeleteIcon } from "@chakra-ui/icons";
import { api } from "../api";
import CalendarGrid from "../components/CalendarGrid";
import { useAuth } from "../auth";

function yyyymm(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }
function todayStr(){
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
}
function fullName(u){
  if (!u) return "";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.email || u.user_id || "";
}

export default function Centers() {
  const toast = useToast();
  const { me } = useAuth();
  const [centers, setCenters] = useState([]);
  const [centerId, setCenterId] = useState("");
  const [members, setMembers] = useState([]); // [{ user_id, first_name, last_name, email, phone, role }]
  const [membersById, setMembersById] = useState({});
  const [monthDate, setMonthDate] = useState(new Date());
  const [daysMap, setDaysMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [isLead, setIsLead] = useState(false);
  const [tabIndex, setTabIndex] = useState(0);

  // assign modal (Schedule tab)
  const assignDlg = useDisclosure();
  const [assignDate, setAssignDate] = useState("");
  const [assignMedic, setAssignMedic] = useState("");

  // Members tab state
  const [addEmail, setAddEmail] = useState("");
  const [adding, setAdding] = useState(false);
  const [removingId, setRemovingId] = useState(null);

  // Auto-assign state
  const [autoAssigning, setAutoAssigning] = useState(false);

  const monthStr = useMemo(() => yyyymm(monthDate), [monthDate]);

  // ---- theme tokens for Members/Reports tabs ----
  const panelBg   = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");
  const headBg    = useColorModeValue("gray.50", "gray.700");
  const mutedText = useColorModeValue("gray.600", "gray.400");

  // ---- reports state ----
  const centerNameById = (centers, id) => centers.find(c => c._id === id)?.name || id;
  const [exporting, setExporting] = useState(false);

  const [reportMonth, setReportMonth] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; // YYYY-MM
  });
  const [reportRows, setReportRows] = useState([]);
  const [reportTotal, setReportTotal] = useState(0);
  const [reportLoading, setReportLoading] = useState(false);

  async function loadReports(cId, mStr) {
    if (!cId || !mStr) return;
    setReportLoading(true);
    try {
      const data = await api.centerReports(cId, mStr);
      setReportRows(data.rows || []);
      setReportTotal(data.total || 0);
    } catch (e) {
      setReportRows([]);
      setReportTotal(0);
      toast({ status:"error", title: e.message });
    } finally {
      setReportLoading(false);
    }
  }
  useEffect(() => { if (centerId) loadReports(centerId, reportMonth); }, [centerId, reportMonth]);

  async function loadCenters() {
    const data = await api.centersList();
    setCenters(data.centers || []);
    if (!centerId && data.centers?.[0]?._id) setCenterId(data.centers[0]._id);
  }

  async function loadMembers(cId) {
    const data = await api.centerMembers(cId);
    const list = data.members || [];
    setMembers(list);

    const map = {};
    list.forEach(m => {
      map[m.user_id] = {
        first_name: m.first_name,
        last_name:  m.last_name,
        email:      m.email,
        phone:      m.phone,
        role:       m.role,
      };
    });
    setMembersById(map);

    const myMember = list.find(m => m.user_id === me.id);
    setIsLead(me.global_role === "admin" || myMember?.role === "lead");
  }

async function loadSchedule(cId, mStr) {
  const data = await api.scheduleGet(cId, mStr);
  const m = {};
  (data.days || []).forEach(d => {
    m[d.date] = {
      assigned: d.assigned,
      medic_id: d.medic_id,
      // NEW: keep names from backend so past assignments still display nicely
      first_name: d.medic_first_name,
      last_name: d.medic_last_name,
      email: d.medic_email,
    };
  });
  setDaysMap(m);
}


  async function refreshAll(cId = centerId, mStr = monthStr) {
    if (!cId) return;
    setLoading(true);
    try {
      await Promise.all([loadMembers(cId), loadSchedule(cId, mStr)]);
    } catch (e) {
      toast({ status:"error", title:e.message });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadCenters(); /* eslint-disable-next-line */ }, []);
  useEffect(() => { if (centerId) refreshAll(centerId, monthStr); /* eslint-disable-next-line */ }, [centerId, monthStr]);

  const prev = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1));
  const next = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1));

  // ---------- Schedule ----------
  const onDayClick = (dateStr, info) => {
    if (!isLead) return;
    setAssignDate(dateStr);
    setAssignMedic(info?.medic_id || "");
    assignDlg.onOpen();
  };

  const saveAssign = async () => {
    if (!assignMedic) return toast({ status:"warning", title:"Select a medic" });
    try {
      if (daysMap[assignDate]?.assigned) {
        await api.scheduleReplace(centerId, assignMedic, assignDate);
      } else {
        await api.scheduleAssign(centerId, assignMedic, assignDate);
      }
      assignDlg.onClose();
      await refreshAll();
      toast({ status:"success", title:"Assigned" });
    } catch (e) {
      toast({ status:"error", title:e.message });
    }
  };

  // ---------- Auto-assign whole month ----------
  // ---------- Auto-assign whole month (avoid consecutive days if possible) ----------
const autoAssignMonth = async () => {
  if (!isLead || !centerId) return;

  if (!confirm("Atribuiți automat toate zilele NEATRIBUITE din această lună? Aceasta va evita zilele consecutive, dacă este posibil, și va menține echilibrul în atribuiri..")) {
    return;
  }

  // helpers
  const toYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${dd}`;
  };
  const addDays = (ymd, delta) => {
    const [y, m, d] = ymd.split("-").map(Number);
    const dt = new Date(y, m - 1, d);
    dt.setDate(dt.getDate() + delta);
    return toYMD(dt);
  };
  const today = todayStr();

  setAutoAssigning(true);
  try {
    // eligible pool (include leads too; change to m.role === "medic" if you want medics-only)
    const eligible = members
      .filter(m => ["medic", "lead"].includes(m.role))
      .map(m => m.user_id);

    if (eligible.length === 0) {
      toast({ status: "warning", title: "No eligible members to assign." });
      setAutoAssigning(false);
      return;
    }

    // current counts & a working assignments map we can reference while we go
    const counts = Object.fromEntries(eligible.map(id => [id, 0]));
    const current = {};
    Object.entries(daysMap).forEach(([d, info]) => {
      if (info?.assigned && info.medic_id) {
        current[d] = info.medic_id;
        if (counts[info.medic_id] != null) counts[info.medic_id] += 1;
      } else {
        current[d] = null;
      }
    });

    // targets: unassigned, not in past, chronological
    const datesToFill = Object.keys(current)
      .filter(d => !current[d] && d >= today)
      .sort();

    let assigned = 0;

    for (const date of datesToFill) {
      // prefer lowest-count medics first (for fairness)
      const baseOrder = eligible.slice().sort((a, b) => counts[a] - counts[b]);

      // try to avoid assigning the same medic as prev/next day
      const prevDate = addDays(date, -1);
      const nextDate = addDays(date, +1);
      const prevMedic = current[prevDate] || null;
      const nextMedic = current[nextDate] || null;

      const preferred = baseOrder.filter(id => id !== prevMedic && id !== nextMedic);
      const fallback = baseOrder; // if preferred all fail, allow consecutive days

      const tryAssignFrom = async (list) => {
        for (const uid of list) {
          try {
            await api.scheduleAssign(centerId, uid, date);
            // reflect immediately in our local state so the next iterations see it
            current[date] = uid;
            counts[uid] += 1;
            assigned += 1;
            return true;
          } catch (e) {
            // skip on any conflict (busy, double-booked, already taken due to races)
            continue;
          }
        }
        return false;
      };

      // 1) prefer not-consecutive
      let placed = await tryAssignFrom(preferred);
      // 2) if not possible, allow consecutive
      if (!placed) await tryAssignFrom(fallback);
    }

    await refreshAll();
    toast({ status: "success", title: `Auto-assigned ${assigned} day(s)` });
  } catch (e) {
    toast({ status: "error", title: e.message || "Auto-assign failed" });
  } finally {
    setAutoAssigning(false);
  }
};


  // ---------- Members ----------
  const addMemberByEmail = async () => {
    const email = addEmail.trim().toLowerCase();
    if (!email) return toast({ status:"warning", title:"Enter an email" });
    setAdding(true);
    try {
      const u = await api.userFindByEmail(email); // { id, ... }
      if (!u?.id) throw new Error("User not found");
      if (u.status !== "approved") throw new Error("User is not approved");

      await api.centerAddMember(centerId, u.id);
      setAddEmail("");
      await loadMembers(centerId);
      toast({ status:"success", title:`Added ${[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email}` });
    } catch (e) {
      toast({ status:"error", title: e.message || "Failed to add member" });
    } finally {
      setAdding(false);
    }
  };

  const removeMember = async (userId) => {
    if (!confirm("Sterge medicul din acest centru?")) return;
    setRemovingId(userId);
    try {
      await api.centerRemoveMember(centerId, userId);
      await loadMembers(centerId);
      toast({ status:"success", title:"Member sters" });
    } catch (e) {
      toast({ status:"error", title:e.message });
    } finally {
      setRemovingId(null);
    }
  };

  if (loading && !centerId) return <Spinner />;

  return (
    <Box>
      {/* Header row */}
      <HStack mb={3} spacing={3}>
        <Heading size="md">Centrul</Heading>
        <Select width="sm" value={centerId} onChange={(e)=>setCenterId(e.target.value)}>
          {centers.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
        </Select>
        {tabIndex === 0 && (
          <HStack ml="auto">
            <Button size="sm" onClick={prev}>◀ </Button>
            <Button size="sm" onClick={next}> ▶</Button>
          </HStack>
        )}
      </HStack>

      <Tabs colorScheme="blue" isFitted index={tabIndex} onChange={setTabIndex}>
        <TabList>
          <Tab>Program</Tab>
          <Tab>Membrii</Tab>
          <Tab>Rapoarte</Tab>
        </TabList>
        <TabPanels>

          {/* SCHEDULE TAB */}
          <TabPanel px={0}>
            <HStack mb={2}>
              <Text color={mutedText}>
                {isLead ? "Sunteti coordonator — apasati o data pentru a seta/modifica medicul de tura." : ""}
              </Text>
              {isLead && (
                <Button
                  ml="auto"
                  colorScheme="purple"
                  onClick={autoAssignMonth}
                  isLoading={autoAssigning}
                >
                  Programare automata
                </Button>
              )}
            </HStack>

            {loading ? <Spinner /> : (
              <CalendarGrid
                year={monthDate.getFullYear()}
                month={monthDate.getMonth()+1}
                daysMap={daysMap}
                onDayClick={onDayClick}
                isLead={isLead}
                membersById={membersById}
                disablePast
              />
            )}

            <Modal isOpen={assignDlg.isOpen} onClose={assignDlg.onClose} isCentered>
              <ModalOverlay />
              <ModalContent>
                <ModalHeader>Programeaza {assignDate}</ModalHeader>
                <ModalBody>
                  <FormControl>
                    <FormLabel>Medic</FormLabel>
                    <Select
                      placeholder="Alege medic"
                      value={assignMedic}
                      onChange={(e)=>setAssignMedic(e.target.value)}
                    >
                      {members.map(m => {
                        const disp = fullName(m) || m.user_id;
                        return (
                          <option key={m.user_id} value={m.user_id}>
                            {disp}
                          </option>
                        );
                      })}
                    </Select>
                  </FormControl>
                </ModalBody>
                <ModalFooter>
                  <Button mr={3} onClick={assignDlg.onClose}>Cancel</Button>
                  <Button colorScheme="blue" onClick={saveAssign}>Save</Button>
                </ModalFooter>
              </ModalContent>
            </Modal>
          </TabPanel>

          {/* MEMBERS TAB */}
          <TabPanel>
            <HStack mb={3} align="flex-end">
              <Heading size="sm">Membrii</Heading>
              <Badge ml={2} colorScheme={isLead ? "purple" : "gray"}>
                {isLead ? "Coordonator" : ""}
              </Badge>
            </HStack>

            {isLead && (
              <HStack mb={4} spacing={3}>
                <FormControl maxW="md">
                  <FormLabel mb={1}>Adauga membru</FormLabel>
                  <HStack>
                    <Input
                      placeholder="user@example.com"
                      value={addEmail}
                      onChange={(e)=>setAddEmail(e.target.value)}
                    />
                    <Button onClick={addMemberByEmail} colorScheme="blue" isLoading={adding}>
                      Adauga
                    </Button>
                  </HStack>
                  <Text mt={1} fontSize="sm" color={mutedText}>
                    Utilizatorul trebuie sa existe si sa fie aprobat.
                  </Text>
                </FormControl>
              </HStack>
            )}

            <Box border="1px" borderColor={borderCol} rounded="md" overflow="hidden" bg={panelBg}>
              <Table size="sm">
                <Thead bg={headBg}>
                  <Tr>
                    <Th>Nume</Th>
                    <Th>Email</Th>
                    <Th>Telefon</Th>
                    <Th>Rol</Th>
                    {isLead && <Th width="1%">Actions</Th>}
                  </Tr>
                </Thead>
                <Tbody>
                  {(members || []).map((m) => {
                    const name = fullName(m);
                    return (
                      <Tr key={m.user_id}>
                        <Td>{name}</Td>
                        <Td>{m.email || "—"}</Td>
                        <Td>{m.phone || "—"}</Td>
                        <Td textTransform="capitalize">
                          {m.role === "lead" ? "coordonator" : m.role}
                        </Td>
                        {isLead && (
                          <Td>
                            <IconButton
                              aria-label="Remove"
                              size="sm"
                              colorScheme="red"
                              icon={<DeleteIcon />}
                              onClick={() => removeMember(m.user_id)}
                              isLoading={removingId === m.user_id}
                            />
                          </Td>
                        )}
                      </Tr>
                    );
                  })}
                  {members.length === 0 && (
                    <Tr>
                      <Td colSpan={isLead ? 5 : 4}><Text py={2} color={mutedText}>No members yet</Text></Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

          {/* REPORTS TAB */}
          <TabPanel>
            <HStack mb={3} spacing={3} align="flex-end">
              <Heading size="sm">Rapoarte</Heading>

              <Box>
                <Text fontSize="sm" mb={1} color={mutedText}>Luna</Text>
                <Input
                  type="month"
                  value={reportMonth}
                  onChange={(e)=>setReportMonth(e.target.value)}
                  maxW="200px"
                />
              </Box>

              <Button onClick={()=>loadReports(centerId, reportMonth)} isLoading={reportLoading}>
                Refresh
              </Button>

              <Button
                onClick={async () => {
                  try {
                    setExporting(true);
                    const blob = await api.centerReportsCsv(centerId, reportMonth);
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    const safeCenter = centerNameById(centers, centerId).replace(/[^\w\-]+/g, "_");
                    a.href = url;
                    a.download = `center_${safeCenter}_${reportMonth}_report.csv`;
                    document.body.appendChild(a);
                    a.click();
                    a.remove();
                    URL.revokeObjectURL(url);
                  } catch (e) {
                    toast({ status: "error", title: e.message });
                  } finally {
                    setExporting(false);
                  }
                }}
                isLoading={exporting}
                variant="outline"
              >
                Export CSV
              </Button>

              <Badge ml="auto" colorScheme="gray">
                Numar zile programate: {reportTotal}
              </Badge>
            </HStack>

            <Box border="1px" borderColor={borderCol} rounded="md" overflow="hidden" bg={panelBg}>
              <Table size="sm">
                <Thead bg={headBg}>
                  <Tr>
                    <Th>Prenume</Th>
                    <Th>Nume</Th>
                    <Th>Email</Th>
                    <Th isNumeric># Progamari</Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {reportRows.map((r) => (
                    <Tr key={r.medic_id}>
                      <Td>{r.first_name || "—"}</Td>
                      <Td>{r.last_name || "—"}</Td>
                      <Td>{r.email || "—"}</Td>
                      <Td isNumeric>{r.count}</Td>
                    </Tr>
                  ))}
                  {(!reportRows || reportRows.length === 0) && !reportLoading && (
                    <Tr>
                      <Td colSpan={4}>
                        <Text py={2} color={mutedText}>No assignments in this month.</Text>
                      </Td>
                    </Tr>
                  )}
                </Tbody>
              </Table>
            </Box>
          </TabPanel>

        </TabPanels>
      </Tabs>
    </Box>
  );
}
