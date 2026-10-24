import { createContext, useContext } from 'react';

/** What a widget's card needs to know about the grid slot it sits in. */
export interface WidgetSlot {
  /** Edit mode: the card shows its controls and its content dims. */
  editing: boolean;
  /** The card is in the user's hand. */
  lifted: boolean;
  /** Mover · width · Quitar, rendered at the top of the card in edit mode. */
  controls: React.ReactNode;
}

const WidgetSlotContext = createContext<WidgetSlot | null>(null);

export const WidgetSlotProvider = WidgetSlotContext.Provider;

/** The slot around the current card, or null outside the configurable grid. */
export function useWidgetSlot(): WidgetSlot | null {
  return useContext(WidgetSlotContext);
}
