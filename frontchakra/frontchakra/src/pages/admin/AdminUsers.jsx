import { useEffect, useMemo, useState } from "react";
import {
  Box, Heading, Input, Table, Thead, Tbody, Tr, Th, Td,
  Button, HStack, useToast, useDisclosure, Modal, ModalOverlay, ModalContent,
  ModalHeader, ModalBody, ModalFooter, FormControl, FormLabel, useColorModeValue,
  Badge, Spacer
} from "@chakra-ui/react";
import { api } from "../../api";

export default function AdminUsers() {
  const toast = useToast();
  const [users, setUsers] = useState([]);
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(false);

  // theming
  const panelBg   = useColorModeValue("white", "gray.800");
  const borderCol = useColorModeValue("gray.200", "gray.700");
  const headBg    = useColorModeValue("gray.50", "gray.700");

  // modals state
  const [selected, setSelected] = useState(null);
  const emailDlg = useDisclosure();
  const passDlg  = useDisclosure();
  const [newEmail, setNewEmail] = useState("");
  const [newPass, setNewPass]   = useState("");
  const [saving, setSaving]     = useState(false);

  const roStatus = (s) => {
  switch ((s || "").toLowerCase()) {
    case "approved": return "aprobat";
    case "rejected": return "neaprobat";
    case "pending":
    default: return "in asteptare";
  }
};

  const load = async () => {
    setLoading(true);
    try {
      const data = await api.adminUsers();
      setUsers(data.users || []);
    } catch (e) {
      toast({ status: "error", title: e.message || "Failed to load users" });
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); }, []);

  // 1) Hide admins
  const nonAdmins = useMemo(
    () => (users || []).filter(u => (u.global_role || "medic").toLowerCase() !== "admin"),
    [users]
  );

  // 2) Filter by first/last/email
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return nonAdmins;
    return nonAdmins.filter(u =>
      (u.first_name || "").toLowerCase().includes(s) ||
      (u.last_name  || "").toLowerCase().includes(s) ||
      (u.email      || "").toLowerCase().includes(s)
    );
  }, [q, nonAdmins]);

  const openEmail = (u) => { setSelected(u); setNewEmail(u.email || ""); emailDlg.onOpen(); };
  const openPass  = (u) => { setSelected(u); setNewPass(""); passDlg.onOpen(); };

  const saveEmail = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      await api.adminUserUpdateEmail(selected.id, newEmail.trim());
      toast({ status: "success", title: "Email actualizat" });
      emailDlg.onClose();
      await load();
    } catch (e) { toast({ status: "error", title: e.message }); }
    finally { setSaving(false); }
  };

  const savePass = async () => {
    if (!selected) return;
    if (newPass.length < 6) return toast({ status: "warning", title: "Parola trebuie sa fie ≥ 6 caractere" });
    setSaving(true);
    try {
      await api.adminUserSetPassword(selected.id, newPass);
      toast({ status: "success", title: "Parola schimbata" });
      passDlg.onClose();
    } catch (e) { toast({ status: "error", title: e.message }); }
    finally { setSaving(false); }
  };

  // New: approve/reject toggle
  const changeStatus = async (u) => {
    try {
      if (u.status === "approved") {
        await api.adminReject(u.id);
        toast({ status: "info", title: "Utilizator respins" });
      } else {
        // treat pending or rejected as Approve
        await api.adminApprove(u.id);
        toast({ status: "success", title: "Utilizator aprobat" });
      }
      await load();
    } catch (e) {
      toast({ status: "error", title: e.message });
    }
  };

  const removeUser = async (u) => {
    if (!confirm(`Delete user ${u.first_name || ""} ${u.last_name || ""}?`)) return;
    setSaving(true);
    try {
      await api.adminUserDelete(u.id);
      toast({ status: "success", title: "Cont sters" });
      await load();
    } catch (e) { toast({ status: "error", title: e.message }); }
    finally { setSaving(false); }
  };

  return (
    <Box>
      <HStack mb={3} spacing={3}>
        <Heading size="md">Admin • Utilizatori</Heading>
        <Spacer />
        <Input
          maxW="320px"
          placeholder="Filtreaza dupa nume sau email"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
        />
      </HStack>

      <Box bg={panelBg} border="1px" borderColor={borderCol} rounded="md" overflow="hidden">
        <Table size="sm">
          <Thead bg={headBg}>
            <Tr>
              <Th>Prenume</Th>
              <Th>Nume</Th>
              <Th>Email</Th>
              <Th>Status</Th>
              <Th width="1%">Actiuni</Th>
            </Tr>
          </Thead>
          <Tbody>
            {filtered.map(u => (
              <Tr key={u.id}>
                <Td>{u.first_name || "—"}</Td>
                <Td>{u.last_name || "—"}</Td>
                <Td>{u.email || "—"}</Td>
                <Td>
  <Badge colorScheme={
    u.status === "approved" ? "green" :
    u.status === "pending"  ? "yellow" : "red"
  }>
    {roStatus(u.status)}
  </Badge>
</Td>
                <Td>
                  <HStack spacing={2}>
                    <Button size="xs" onClick={()=>openEmail(u)}>Schimba Email</Button>
                    <Button size="xs" variant="outline" onClick={()=>openPass(u)}>Schimba Parola</Button>
                    <Button
                      size="xs"
                      colorScheme={u.status === "approved" ? "yellow" : "green"}
                      onClick={()=>changeStatus(u)}
                    >
                      {u.status === "approved" ? "Respinge" : "Aproba"}
                      
                    </Button>
                    <Button size="xs" colorScheme="red" onClick={()=>removeUser(u)}>Sterge</Button>
                  </HStack>
                </Td>
              </Tr>
            ))}
            {!loading && filtered.length === 0 && (
              <Tr><Td colSpan={5}>No users match your filter.</Td></Tr>
            )}
          </Tbody>
        </Table>
      </Box>

      {/* Change Email */}
      <Modal isOpen={emailDlg.isOpen} onClose={emailDlg.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Schimba email</ModalHeader>
          <ModalBody>
            <FormControl>
              <FormLabel>New email</FormLabel>
              <Input type="email" value={newEmail} onChange={(e)=>setNewEmail(e.target.value)} />
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={emailDlg.onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={saveEmail} isLoading={saving}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Change Password */}
      <Modal isOpen={passDlg.isOpen} onClose={passDlg.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Set New Password</ModalHeader>
          <ModalBody>
            <FormControl>
              <FormLabel>New password</FormLabel>
              <Input type="password" value={newPass} onChange={(e)=>setNewPass(e.target.value)} minLength={6}/>
            </FormControl>
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={passDlg.onClose}>Cancel</Button>
            <Button colorScheme="blue" onClick={savePass} isLoading={saving}>Save</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </Box>
  );
}
