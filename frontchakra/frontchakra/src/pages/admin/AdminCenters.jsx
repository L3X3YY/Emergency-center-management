// src/pages/admin/AdminCenters.jsx
import { useEffect, useMemo, useState } from "react";
import {
  Box, Button, ButtonGroup, HStack, Heading, IconButton, Input, Table, Tbody, Td, Th, Thead, Tr,
  useToast, useDisclosure, useColorModeValue, Modal, ModalOverlay, ModalContent, ModalHeader, ModalBody, ModalFooter,
  Text
} from "@chakra-ui/react";
import { EditIcon, DeleteIcon, StarIcon, AddIcon } from "@chakra-ui/icons";
import { api } from "../../api";
import ReactSelect from "react-select";


export default function AdminCenters() {
  const toast = useToast();
  const [centers, setCenters] = useState([]);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  const rsBg         = useColorModeValue("var(--chakra-colors-white)", "var(--chakra-colors-gray-700)");
const rsText       = useColorModeValue("var(--chakra-colors-gray-800)", "var(--chakra-colors-gray-100)");
const rsBorder     = useColorModeValue("var(--chakra-colors-gray-200)", "var(--chakra-colors-gray-600)");
const rsHoverBg    = useColorModeValue("var(--chakra-colors-gray-50)", "var(--chakra-colors-gray-600)");
const rsMenuBg     = useColorModeValue("var(--chakra-colors-white)", "var(--chakra-colors-gray-700)");
const rsPlaceholder= useColorModeValue("var(--chakra-colors-gray-500)", "var(--chakra-colors-gray-400)");

const reactSelectStyles = {
  control: (base, state) => ({
    ...base,
    backgroundColor: rsBg,
    color: rsText,
    borderColor: state.isFocused ? rsBorder : rsBorder,
    boxShadow: state.isFocused ? "0 0 0 1px var(--chakra-colors-blue-400)" : "none",
    "&:hover": { borderColor: rsBorder },
    minHeight: 40,
  }),
  valueContainer: (base) => ({ ...base, color: rsText }),
  singleValue: (base) => ({ ...base, color: rsText }),
  input: (base) => ({ ...base, color: rsText }),
  placeholder: (base) => ({ ...base, color: rsPlaceholder }),
  menu: (base) => ({
    ...base,
    backgroundColor: rsMenuBg,
    color: rsText,
    zIndex: 10,
  }),
  menuList: (base) => ({ ...base, backgroundColor: rsMenuBg }),
  option: (base, state) => ({
    ...base,
    backgroundColor: state.isFocused ? rsHoverBg : "transparent",
    color: rsText,
    cursor: "pointer",
  }),
  indicatorsContainer: (base) => ({ ...base, color: rsText }),
  dropdownIndicator: (base) => ({ ...base, color: rsText }),
  clearIndicator: (base) => ({ ...base, color: rsText }),
};

  // create
  const [name, setName] = useState("");
  const [location, setLocation] = useState("");

  // filters (now below Add Center)
  const [q, setQ] = useState("");        // search name or location
  const [locQ, setLocQ] = useState("");  // dedicated location text filter

  // edit
  const editDlg = useDisclosure();
  const [editId, setEditId] = useState("");
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");

  // lead
  const leadDlg = useDisclosure();
  const [leadCenterId, setLeadCenterId] = useState("");
  const [leadUser, setLeadUser] = useState("");

  //members
  const memberDlg = useDisclosure();
const [memberCenterId, setMemberCenterId] = useState("");
const [memberUser, setMemberUser] = useState("");

const openMember = (id) => {
  setMemberCenterId(id);
  setMemberUser("");
  memberDlg.onOpen();
};

const assignMember = async () => {
  if (!memberUser) return;
  try {
    await api.centerAddMember(memberCenterId, memberUser); // <-- ensure this is in your api.js
    memberDlg.onClose();
    await load();
    toast({ status: "success", title: "Membru adaugat" });
  } catch (e) {
    toast({ status: "error", title: e.message });
  }
};


  async function load() {
    setLoading(true);
    try {
      const [c, u] = await Promise.all([api.centersList(), api.adminUsers()]);
      setCenters(c.centers || []);
      setUsers((u.users || []).filter(x => x.status === "approved"));
    } catch (e) {
      toast({ status:"error", title:e.message });
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); }, []);

  const create = async () => {
    if (!name.trim()) return;
    try {
      await api.centerCreate({ name: name.trim(), location: location.trim() });
      setName(""); setLocation("");
      await load();
      toast({ status:"success", title:"Centru creat" });
    } catch (e) { toast({ status:"error", title:e.message }); }
  };

  const openEdit = (c) => {
    setEditId(c._id);
    setEditName(c.name);
    setEditLocation(c.location || "");
    editDlg.onOpen();
  };

  const saveEdit = async () => {
    try {
      await api.centerUpdate(editId, { name: editName.trim(), location: editLocation.trim() });
    editDlg.onClose();
      await load();
      toast({ status:"success", title:"Centru actualizat" });
    } catch (e) { toast({ status:"error", title:e.message }); }
  };

  const remove = async (id) => {
    if (!confirm("Vrei sa stergi centrul? Programarii vor fi de asemenea sterse.")) return;
    try {
      await api.centerDelete(id);
      await load();
      toast({ status:"success", title:"Centru sters" });
    } catch (e) { toast({ status:"error", title:e.message }); }
  };

  const openLead = (id) => { setLeadCenterId(id); setLeadUser(""); leadDlg.onOpen(); };
  const assignLead = async () => {
    if (!leadUser) return;
    try {
      await api.centerAssignLead(leadCenterId, leadUser);
      leadDlg.onClose();
      await load();
      toast({ status:"success", title:"Coordonator alocat" });
    } catch (e) { toast({ status:"error", title:e.message }); }
  };

  // ---------- filtering ----------
  const filteredCenters = useMemo(() => {
    const text = q.trim().toLowerCase();
    const loc = locQ.trim().toLowerCase();
    return (centers || []).filter(c => {
      const nm = (c.name || "").toLowerCase();
      const lc = (c.location || "").toLowerCase();
      const matchesText = !text || nm.includes(text) || lc.includes(text);
      const matchesLoc  = !loc  || lc.includes(loc);
      return matchesText && matchesLoc;
    });
  }, [centers, q, locQ]);

  return (
    <Box>
      <Heading size="md" mb={3}>Admin • Centre</Heading>

      {/* Create row */}
      <HStack gap={2} mb={3} align="flex-end" flexWrap="wrap">
        <Input
          placeholder="Nume Centru"
          value={name}
          onChange={(e)=>setName(e.target.value)}
          maxW="320px"
        />
        <Input
          placeholder="Locatie"
          value={location}
          onChange={(e)=>setLocation(e.target.value)}
          maxW="320px"
        />
        <Button
          colorScheme="blue"
          onClick={create}
          size="md"
          px={5}
          flexShrink={0}
          whiteSpace="nowrap"
        >
          Adauga centru
        </Button>
      </HStack>

      {/* Filters (moved underneath) */}
      <HStack gap={2} mb={5} flexWrap="wrap">
        <Input
          placeholder="Filtreaza dupa nume"
          value={q}
          onChange={(e)=>setQ(e.target.value)}
          maxW="320px"
        />
        <Input
          placeholder="Filtreaza dupa locatie"
          value={locQ}
          onChange={(e)=>setLocQ(e.target.value)}
          maxW="260px"
        />
        <Button variant="outline" onClick={()=>{ setQ(""); setLocQ(""); }}>
          Sterge filtre
        </Button>
      </HStack>

      <Table size="sm" variant="simple">
        <Thead>
          <Tr>
            <Th>Nume</Th>
            <Th>Locatie</Th>
            <Th>Actiuni</Th>
          </Tr>
        </Thead>
        <Tbody>
          {filteredCenters.map(c => (
            <Tr key={c._id}>
              <Td>{c.name}</Td>
              <Td>{c.location || "—"}</Td>
              <Td>
                <ButtonGroup size="sm" variant="ghost">
                  <IconButton aria-label="Edit" icon={<EditIcon />} onClick={()=>openEdit(c)} />
                  <IconButton aria-label="Assign lead" icon={<StarIcon />} onClick={()=>openLead(c._id)} />
                  <IconButton aria-label="Add member" icon={<AddIcon />} onClick={()=>openMember(c._id)} />
                  <IconButton aria-label="Delete" colorScheme="red" icon={<DeleteIcon />} onClick={()=>remove(c._id)} />
                </ButtonGroup>
              </Td>
            </Tr>
          ))}
          {filteredCenters.length === 0 && (
            <Tr><Td colSpan={3}><Text>No centers</Text></Td></Tr>
          )}
        </Tbody>
      </Table>

      {/* Edit Modal */}
      <Modal isOpen={editDlg.isOpen} onClose={editDlg.onClose} isCentered>
        <ModalOverlay />
        <ModalContent>
          <ModalHeader>Editeaza Centru</ModalHeader>
          <ModalBody>
            <Input mb={3} value={editName} onChange={(e)=>setEditName(e.target.value)} placeholder="Nume" />
            <Input value={editLocation} onChange={(e)=>setEditLocation(e.target.value)} placeholder="Locatie" />
          </ModalBody>
          <ModalFooter>
            <Button mr={3} onClick={editDlg.onClose}>Anuleaza</Button>
            <Button colorScheme="blue" onClick={saveEdit}>Salveaza</Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      {/* Add Member Modal */}
<Modal isOpen={memberDlg.isOpen} onClose={memberDlg.onClose} isCentered>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>Adauga Membru</ModalHeader>
    <ModalBody>


      <ReactSelect
        options={users.map(u => ({
          value: u.id,
          label: `${[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} — ${u.email}`
        }))}
        value={
          users.find(u => u.id === memberUser)
            ? {
                value: memberUser,
                label: `${[users.find(u => u.id === memberUser)?.first_name,
                           users.find(u => u.id === memberUser)?.last_name]
                          .filter(Boolean).join(" ") || users.find(u => u.id === memberUser)?.email}
                          — ${users.find(u => u.id === memberUser)?.email}`
              }
            : null
        }
        onChange={(opt) => setMemberUser(opt?.value || "")}
        placeholder="Cauta utilizatori..."
        isClearable
        styles={reactSelectStyles}  // reuse same styles from lead modal
      />
    </ModalBody>
    <ModalFooter>
      <Button mr={3} onClick={memberDlg.onClose}>Anuleaza</Button>
      <Button colorScheme="blue" onClick={assignMember} isDisabled={!memberUser}>
        Adauga membru
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>

      {/* Lead Modal */}
<Modal isOpen={leadDlg.isOpen} onClose={leadDlg.onClose} isCentered>
  <ModalOverlay />
  <ModalContent>
    <ModalHeader>Aloca coordoonator</ModalHeader>
    <ModalBody>


      <ReactSelect
        options={users.map(u => ({
          value: u.id,
          label:
            `${[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} — ${u.email}`
        }))}
        value={
          users
            .map(u => ({
              value: u.id,
              label:
                `${[u.first_name, u.last_name].filter(Boolean).join(" ") || u.email} — ${u.email}`
            }))
            .find(opt => opt.value === leadUser) || null
        }
        onChange={(opt) => setLeadUser(opt?.value || "")}
        placeholder="Search users..."
        isClearable
        styles={reactSelectStyles}
      />

    </ModalBody>
    <ModalFooter>
      <Button mr={3} onClick={leadDlg.onClose}>Anuleaza</Button>
      <Button colorScheme="blue" onClick={assignLead} isDisabled={!leadUser}>
        Aloca
      </Button>
    </ModalFooter>
  </ModalContent>
</Modal>
    </Box>
  );
}
