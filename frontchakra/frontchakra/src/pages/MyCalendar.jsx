import { useEffect, useMemo, useState } from "react";
import { Box, Button, HStack, Heading, Spinner, Text, useToast } from "@chakra-ui/react";
import CalendarGrid from "../components/CalendarGrid";
import { api } from "../api";

function yyyymm(d){ return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`; }

export default function MyCalendar() {
  const [monthDate, setMonthDate] = useState(new Date());
  const [shifts, setShifts] = useState([]); // {date, center_id, center_name}
  const [busy, setBusy] = useState([]);     // [dateStr]
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState(null);
  const toast = useToast();
  const monthStr = useMemo(() => yyyymm(monthDate), [monthDate]);

  async function load() {
    try {
      setLoading(true);
      const [s, b] = await Promise.all([api.mySchedule(monthStr), api.myBusyList(monthStr)]);
      setShifts(s.days || []);
      setBusy(b.days || []);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [monthStr]);

  const daysMap = useMemo(() => {
    const m = {};
    shifts.forEach(d => { m[d.date] = { assigned: true, center_id: d.center_id, center_name: d.center_name }; });
    busy.forEach(date => {
      if (!m[date]) m[date] = { assigned: false };
      m[date].busy = true;
    });
    return m;
  }, [shifts, busy]);

  const prev = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()-1, 1));
  const next = () => setMonthDate(new Date(monthDate.getFullYear(), monthDate.getMonth()+1, 1));

  const toggleBusy = async (dateStr, info = {}) => {
    if (info.assigned) return toast({ status:"info", title:"You already have a shift that day." });
    setSaving(true);
    try {
      if (info.busy) await api.myBusyRemove(dateStr);
      else await api.myBusyAdd(dateStr);
      await load();
    } catch (e) {
      toast({ status:"error", title:e.message });
    } finally {
      setSaving(false);
    }
  };

  if (loading && shifts.length === 0 && busy.length === 0) return <Spinner /> ;
  if (err) return <Text color="red.500">Error: {err}</Text>;

  return (
    <Box>
      <HStack mb={3} spacing={3}>
        <Heading size="md">Calendarul meu</Heading>
        {saving && <Spinner size="sm" />}
        <HStack ml="auto">
          <Button size="sm" onClick={prev}>◀ </Button>
          <Button size="sm" onClick={next}> ▶</Button>
        </HStack>
      </HStack>

      <Text mb={3} color="gray.600">Apasa o data pentru statusul <b>Indisponibil</b>. Coordonatorii nu va pot programa in acele date.</Text>

      <CalendarGrid
        year={monthDate.getFullYear()}
        month={monthDate.getMonth()+1}
        daysMap={daysMap}
        onDayClick={toggleBusy}
        clickable
        clickHint="(apasa pentru indisponibil)"
        labelFor={(info) => `Centru: ${info.center_name}`}
        disablePast
      />
    </Box>
  );
}
