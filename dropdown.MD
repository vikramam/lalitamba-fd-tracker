# The "Bottom Sheet Picker" pattern (MIG Stock / Family Deposit Tracker)

What looks like a dropdown in the MIG app ("Select customer", etc.) is **not** a
native `<select>` or a MUI `Select`/Menu. It's a **native-mobile bottom sheet**
containing a scrollable list — the same sheet component used for "Add item",
receipts, and hamburger menus. Tapping the field slides a panel up from the
bottom of the screen instead of popping a dropdown open in place.

This doc describes the pattern generically so it can be ported into any
React + MUI app.

## Why not a plain `<Select>`

- A native `<select>` / MUI `Menu`-based `Select` renders as a small anchored
  popover — cramped on mobile, easy to fat-finger, and visually inconsistent
  with everything else in a "native app" feeling UI.
- A bottom sheet gets full-width tap targets, room for secondary text (e.g. a
  phone number under a customer's name), an inline "add new" action, and it's
  the same interaction language as every other "choose one" moment in the app.

## Anatomy: two pieces

1. **The trigger** — not a real form field, just a `Box`/`Paper` styled to
   *look* like one (icon, label, chevron), with an `onClick` that opens the
   sheet.
2. **The sheet** — a generic, content-agnostic `BottomSheet` component (thin
   wrapper around MUI's `Drawer` with `anchor="bottom"`), and inside it a
   `List` of `ListItemButton`s, one per option, each closing the sheet on
   select.

The sheet component itself knows nothing about "customers" — it's reused for
every bottom-sheet-shaped thing in the app (menus, forms, pickers). Only the
call site knows what's being picked.

## 1. The generic `BottomSheet` component

\`\`\`tsx
// src/components/BottomSheet.tsx
import { ReactNode } from 'react';
import { Box, Drawer, IconButton, Stack, Typography } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close'; // or your own icon set

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: ReactNode;
  /** Caps the sheet's width on wider viewports so it doesn't stretch
   *  full-bleed like a phone sheet would — it still anchors to the
   *  bottom, just centered and narrower. */
  maxWidth?: number;
}

export default function BottomSheet({ open, onClose, children, title, maxWidth }: BottomSheetProps) {
  return (
    <Drawer
      anchor="bottom"
      open={open}
      onClose={onClose}
      // MUI's z-index scale puts Drawer (1200) BELOW Dialog/Modal (1300).
      // Bump it above `modal` so a sheet can always layer on top of a
      // Dialog too (e.g. opening a picker sheet from inside a dialog).
      sx={{ zIndex: (theme) => theme.zIndex.modal + 1 }}
      PaperProps={{
        sx: {
          maxWidth: maxWidth ?? 560,
          mx: 'auto',
          maxHeight: '88vh',
          borderRadius: '24px 24px 0 0',
          pb: 'env(safe-area-inset-bottom)' // clears the iOS home indicator
        }
      }}
    >
      {/* grab handle */}
      <Box sx={{ width: 36, height: 4, borderRadius: 2, bgcolor: 'divider', mx: 'auto', mt: 1.5, mb: title ? 1 : 1.5 }} />

      {title && (
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 2.5, pb: 1 }}>
          <Typography variant="subtitle1">{title}</Typography>
          <IconButton size="small" onClick={onClose} aria-label="Close">
            <CloseIcon fontSize="small" />
          </IconButton>
        </Stack>
      )}

      <Box sx={{ px: 2.5, pb: 2, overflowY: 'auto' }}>{children}</Box>
    </Drawer>
  );
}
\`\`\`

Notes:
- `Drawer` (not `SwipeableDrawer`) is enough — swipe-to-dismiss is a nice-to-have,
  not the point of the pattern. (MIG's picker sheets use plain `Drawer`; its
  hamburger menu uses `SwipeableDrawer` for swipe-to-close. Either works —
  `SwipeableDrawer` just needs `onOpen={() => {}}` and usually `disableSwipeToOpen`.)
- The rounded top corners + glass/blur treatment (if your theme has one) belong
  in a **theme-level** override for `MuiDrawer`'s `anchor="bottom"` paper, not
  hardcoded per sheet — see the theme snippet below.

### Theme override (optional but recommended)

If your app's `theme.ts` doesn't already style bottom-anchored drawers, add:

\`\`\`ts
MuiDrawer: {
  styleOverrides: {
    paper: ({ ownerState, theme }: any) =>
      ownerState.anchor === 'bottom'
        ? {
            borderTopLeftRadius: 24,
            borderTopRightRadius: 24,
            backgroundColor: theme.palette.background.paper,
            borderTop: `1px solid ${theme.palette.divider}`
          }
        : {}
  }
}
\`\`\`

This way every bottom sheet in the app — menu, forms, pickers — automatically
gets the same rounded-top, native-sheet look with zero per-sheet styling.

## 2. The trigger ("fake field")

\`\`\`tsx
<Box
  onClick={() => setPickerOpen(true)}
  sx={{
    display: 'flex',
    alignItems: 'center',
    gap: 1.5,
    p: 1.25,
    borderRadius: 2,
    border: '1px solid',
    borderColor: 'divider',
    cursor: 'pointer'
  }}
>
  <Box sx={{ width: 36, height: 36, borderRadius: '50%', bgcolor: 'action.hover',
             display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
    <PersonIcon fontSize="small" sx={{ color: 'text.secondary' }} />
  </Box>
  <Box sx={{ flex: 1 }}>
    <Typography variant="body2" sx={{ fontWeight: 600 }}>
      {selected ? selected.name : 'Walk-in customer'}
    </Typography>
    <Typography variant="caption" color="text.secondary">
      Tap to choose customer
    </Typography>
  </Box>
  <ChevronRightIcon fontSize="small" sx={{ color: 'text.secondary' }} />
</Box>
\`\`\`

The label/sublabel pair (`selected value` + a small "Tap to choose…" hint) is
what makes it read as a field rather than a random clickable row — worth
keeping even when the icon/avatar isn't needed.

## 3. The sheet content — a selectable list

\`\`\`tsx
<BottomSheet open={pickerOpen} onClose={() => setPickerOpen(false)} title="Choose customer">
  <List sx={{ pt: 0 }}>
    {/* Optional "none" / default option */}
    <ListItemButton
      selected={!selected}
      onClick={() => { setSelected(null); setPickerOpen(false); }}
      sx={{ borderRadius: 2, mb: 0.5 }}
    >
      <ListItemText primary="Walk-in customer" />
      {!selected && (
        <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>
          <CheckIcon fontSize="small" />
        </ListItemIcon>
      )}
    </ListItemButton>

    {options.map((o) => (
      <ListItemButton
        key={o.id}
        selected={selected?.id === o.id}
        onClick={() => { setSelected(o); setPickerOpen(false); }}
        sx={{ borderRadius: 2, mb: 0.5 }}
      >
        <ListItemText primary={o.name} secondary={o.phone || undefined} />
        {selected?.id === o.id && (
          <ListItemIcon sx={{ minWidth: 0, color: 'primary.main' }}>
            <CheckIcon fontSize="small" />
          </ListItemIcon>
        )}
      </ListItemButton>
    ))}
  </List>

  {/* Optional inline "create new" escape hatch */}
  <Divider sx={{ my: 1 }} />
  <Button
    fullWidth
    variant="outlined"
    startIcon={<PersonAddIcon />}
    onClick={() => { setPickerOpen(false); setCreateDialogOpen(true); }}
  >
    New customer
  </Button>
</BottomSheet>
\`\`\`

Key details worth keeping when you port this:
- **Selecting an option closes the sheet immediately** (`onClick` both sets
  state and calls `setPickerOpen(false)`) — there's no separate "Confirm"
  button for a single-select picker. (A multi-select picker would need one.)
- The **checkmark only renders on the selected row**, using `ListItemIcon` at
  `minWidth: 0` so it doesn't reserve space on unselected rows.
- `selected` prop on `ListItemButton` gives the row MUI's built-in tinted
  background for the active option, for free.
- The "New customer" action lives *inside the same sheet*, below a `Divider`
  — closing the picker sheet and opening a separate create-dialog on top,
  rather than cluttering the picker's own list with an "+ Add" row.

## Wiring it up

\`\`\`tsx
const [options, setOptions] = useState<Option[]>([]);
const [selected, setSelected] = useState<Option | null>(null);
const [pickerOpen, setPickerOpen] = useState(false);
\`\`\`

That's the whole state shape — no library, no extra dependency. If the list
can be long, consider a search `TextField` pinned above the `List` inside the
sheet (not shown above; MIG's picker lists are short enough not to need it).

## When to reach for this vs. a plain MUI `Select`

Use the bottom sheet picker when:
- The app already uses bottom sheets elsewhere (forms, menus) — this keeps
  the interaction language consistent.
- Options need secondary text, an avatar/icon, or an inline "add new" escape
  hatch — a `Select`'s `MenuItem` can technically hold all that, but it reads
  cramped.
- You're deliberately going for the "feels like a native app" aesthetic.

A plain `Select` is still fine for short, simple, unambiguous choices (e.g. a
status filter with 3 values) where a full-screen-ish sheet would be overkill.
