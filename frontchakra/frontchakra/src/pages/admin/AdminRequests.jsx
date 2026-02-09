import { useEffect, useState } from "react";
import {
  Box, Button, Heading, Table, Thead, Tbody, Tr, Th, Td, Text, HStack, useToast
} from "@chakra-ui/react";
import { api } from "../../api";

export default function AdminRequests() {
  const toast = useToast();
  const [pending, setPending] = useState([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const data = await api.adminPending();
      setPending(data.pending || []);
    } catch (e) {
      toast({ status: "error", title: e.message });
    } finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);

  const approve = async (id) => {
    try { await api.adminApprove(id); await load(); toast({ status: "success", title: "Aprobat" }); }
    catch (e) { toast({ status: "error", title: e.message }); }
  };
  const reject = async (id) => {
    try { await api.adminReject(id); await load(); toast({ status: "success", title: "Respins" }); }
    catch (e) { toast({ status: "error", title: e.message }); }
  };

  const fullName = (p) => [p.first_name, p.last_name].filter(Boolean).join(" ").trim();

  return (
    <Box>
      <Heading size="md" mb={3}>Admin • Cereri</Heading>
      <Table size="sm">
        <Thead>
          <Tr>
            <Th>Nume</Th>
            <Th>Email</Th>
            <Th>Actiuni</Th>
          </Tr>
        </Thead>
        <Tbody>
          {pending.map(p => (
            <Tr key={p.id}>
              <Td>{fullName(p) || "—"}</Td>
              <Td>{p.email}</Td>
              <Td>
                <HStack>
                  <Button size="sm" colorScheme="green" onClick={() => approve(p.id)}>Aproba</Button>
                  <Button size="sm" colorScheme="red" variant="outline" onClick={() => reject(p.id)}>Respinge</Button>
                </HStack>
              </Td>
            </Tr>
          ))}
          {!loading && pending.length === 0 && (
            <Tr>
              <Td colSpan={3}><Text>No pending requests</Text></Td>
            </Tr>
          )}
        </Tbody>
      </Table>
    </Box>
  );
}
