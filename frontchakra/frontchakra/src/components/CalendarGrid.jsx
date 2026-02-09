import { useMemo } from "react";
import { Box, Grid, GridItem, Text, Badge, HStack, useColorModeValue } from "@chakra-ui/react";

function startOfMonth(d){ return new Date(d.getFullYear(), d.getMonth(), 1); }
function endOfMonth(d){ return new Date(d.getFullYear(), d.getMonth()+1, 0); }
function dowMon0(jsDow){ return (jsDow + 6) % 7; }
function todayStr(){
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
}

// Build a display name from first/last, with sensible fallbacks
function fullName(u) {
  if (!u) return "";
  const name = [u.first_name, u.last_name].filter(Boolean).join(" ").trim();
  return name || u.email || "";
}


export default function CalendarGrid({
  year, month, daysMap, onDayClick,
  isLead, clickable, clickHint, labelFor, membersById = {}, disablePast = true,
  footerNote
}) {
  // Header & borders
  const headerBg      = useColorModeValue("gray.50", "gray.700");
  const cellBorder    = useColorModeValue("blue.700", "gray.500");

  // Day cells
  const dayBgPast     = useColorModeValue("gray.50", "gray.700");
  const dayBgFuture   = useColorModeValue("gray.300", "gray.800");
  const dayTextPast   = useColorModeValue("gray.500", "gray.400");

  // Badges
  const unassignedBg      = useColorModeValue("orange.50", "orange.900");
  const unassignedBorder  = useColorModeValue("orange.200", "orange.700");
  const unassignedText    = useColorModeValue("orange.700", "orange.200");

  const { weeks, monthLabel } = useMemo(() => {
    const first = startOfMonth(new Date(year, month - 1, 1));
    const last = endOfMonth(first);

    const leading = dowMon0(first.getDay());
    const cells = [];
    for (let i = 0; i < leading; i++) cells.push(null);
    for (let d = 1; d <= last.getDate(); d++) cells.push(new Date(year, month - 1, d));
    while (cells.length % 7 !== 0) cells.push(null);

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));

    // Eticheta lunii în română (ex: „Martie 2025”)
    const raw = first.toLocaleString("ro-RO", { month: "long", year: "numeric" });
    const label = raw.charAt(0).toUpperCase() + raw.slice(1);

    return { weeks, monthLabel: label };
  }, [year, month]);

  const defaultAssignedLabel = (info) => {
    // Preferă numele atașat zilei (funcționează chiar dacă membrul a fost șters ulterior)
    const dayName =
      [info?.first_name, info?.last_name].filter(Boolean).join(" ").trim() ||
      info?.email ||
      "";

    // Fallback la harta curentă de membri ai centrului
    const u = info?.medic_id ? membersById[info.medic_id] : undefined;
    const memberName = fullName(u);

    const medic = dayName || memberName || info?.medic_id;
    return medic ? `Programat: ${medic}` : "Programat";
  };

  const today = todayStr();

  return (
    <Box>
      {/* Bandă superioară cu luna/anul în stânga */}
      <HStack justify="space-between" mb={2}>
        <Text fontWeight="bold" fontSize="lg">{monthLabel}</Text>
      </HStack>

      {/* Antet zile săptămână (română, Luni–Duminică) */}
      <Grid
        templateColumns="repeat(7, 1fr)"
        bg={headerBg}
        border="1px"
        borderColor={cellBorder}
        borderBottom="0"
        rounded="md"
        overflow="hidden"
      >
        {["Lun","Mar","Mie","Joi","Vin","Sâm","Dum"].map((w) => (
          <GridItem
            key={w}
            p={2}
            textAlign="center"
            fontWeight="semibold"
            border="1px"
            borderColor={cellBorder}
          >
            {w}
          </GridItem>
        ))}
      </Grid>

      {/* Zilele din lună */}
      {weeks.map((row, i) => (
        <Grid key={i} templateColumns="repeat(7, 1fr)" borderLeft="1px" borderRight="1px" borderColor={cellBorder}>
          {row.map((d, j) => {
            if (!d) {
              return (
                <GridItem
                  key={j}
                  border="1px"
                  borderColor={cellBorder}
                  minH="100px"
                  bg={headerBg}
                />
              );
            }
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, "0");
            const dd = String(d.getDate()).padStart(2, "0");
            const key = `${y}-${m}-${dd}`;

            const info = daysMap[key];
            const assigned = info?.assigned;
            const busy = info?.busy === true;
            const isPast = disablePast && key < today;
            const canClick = (typeof clickable === "boolean" ? clickable : isLead) && !isPast;
            const label = assigned ? (labelFor ? labelFor(info, key) : defaultAssignedLabel(info)) : null;

            return (
              <GridItem
                key={j}
                p={2}
                minH="110px"
                border="1px"
                borderColor={cellBorder}
                bg={isPast ? dayBgPast : dayBgFuture}
                color={isPast ? dayTextPast : "inherit"}
                cursor={canClick ? "pointer" : "default"}
                onClick={() => canClick && onDayClick && onDayClick(key, info)}
              >
                <Text fontWeight="semibold">{d.getDate()}</Text>

                {assigned ? (
                  <Badge mt={2} variant="subtle" colorScheme="blue">
                    {label}
                  </Badge>
                ) : (
                  <Badge
                    mt={2}
                    bg={unassignedBg}
                    border="1px solid"
                    borderColor={unassignedBorder}
                    color={unassignedText}
                  >
                    Neprogramat
                  </Badge>
                )}

                {busy && <Badge mt={2} ml={2} colorScheme="red">Indisponibil</Badge>}

                {canClick && (
                  <Text mt={2} fontSize="xs" opacity={0.7}>
                    {clickHint ?? `(clic pentru ${assigned ? "modificare" : "setare"})`}
                  </Text>
                )}
              </GridItem>
            );
          })}
        </Grid>
      ))}

      {/* Notă ajutătoare jos-dreapta */}
      {footerNote && (
        <Text mt={2} textAlign="right" opacity={0.7} fontSize="sm">
          {footerNote}
        </Text>
      )}
    </Box>
  );
}
