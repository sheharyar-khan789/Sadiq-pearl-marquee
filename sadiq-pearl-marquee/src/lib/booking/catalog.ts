// Booking catalog lookups. Since Phase 6 the hall, slots, event types,
// services, menus and packages come from the admin-managed business
// configuration (src/lib/config/business-config.ts); this module re-exports
// its types and helpers so booking code has one import path.
export {
  activeEventTypes,
  activeMenus,
  activePackages,
  activeServices,
  activeSlots,
  anyLabel,
  DEFAULT_CONFIG,
  DEFAULT_HALL_ID,
  getEventType,
  getHall,
  getMenu,
  getPackage,
  getService,
  getSlot,
  SLOT_IDS,
  slotLabel,
  slotTimeText,
  type BusinessConfig,
  type SlotId,
} from "../config/business-config.ts";
