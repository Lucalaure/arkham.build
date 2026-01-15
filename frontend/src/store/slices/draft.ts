import type { StateCreator } from "zustand";
import { assert } from "@/utils/assert";
import { isSpecialCard } from "@/utils/card-utils";
import { range } from "@/utils/range";
import { shuffle } from "@/utils/shuffle";
import type { DeckOption } from "../schemas/card.schema";
import {
  selectAvailableDraftCards,
  selectSignatureCards,
} from "../selectors/draft";
import { selectMetadata } from "../selectors/shared";
import type { StoreState } from ".";
import type { DraftSlice } from "./draft.types";

export const createDraftSlice: StateCreator<StoreState, [], [], DraftSlice> = (
  set,
  get,
) => ({
  draft: undefined,

  initDraft(investigatorCode, cardsPerPick, tabooSetId) {
    const state = get();
    const metadata = selectMetadata(state);

    const investigator = metadata.cards[investigatorCode];
    assert(
      investigator && investigator.type_code === "investigator",
      "Draft must be initialized with an investigator card.",
    );

    // Get signature cards
    const signatureCards = selectSignatureCards(state, investigatorCode);

    // Get the back card code - this is where deck_requirements are defined
    // For double-sided investigators, we need the back card
    const backCardCode = investigator.back_link_id ?? investigatorCode;
    const backCard = metadata.cards[backCardCode];
    assert(backCard, "Back card must exist for investigator.");

    // Get base deck size from back card's deck_requirements
    // Signatures don't count toward the draft target - they're added separately
    // Note: targetDeckSize will be recalculated dynamically as cards are picked
    const baseDeckSize = backCard.deck_requirements?.size ?? 30;

    set({
      draft: {
        phase: "setup",
        investigatorCode,
        cardsPerPick,
        pickedCards: {},
        signatureCards,
        currentOptions: [],
        targetDeckSize: baseDeckSize,
        tabooSetId,
      },
    });
  },

  startDraft() {
    const state = get();
    assert(state.draft, "Draft must be initialized before starting.");

    set({
      draft: {
        ...state.draft,
        phase: "picking",
      },
    });

    // Generate initial options
    get().generateDraftOptions();
  },

  generateDraftOptions() {
    const state = get();
    assert(state.draft, "Draft must be initialized.");

    const { draft } = state;
    const { pickedCards, cardsPerPick, investigatorCode } = draft;

    // Calculate dynamic target deck size based on picked cards that adjust deck size
    const metadata = selectMetadata(state);
    const investigator = metadata.cards[investigatorCode];
    const backCardCode = investigator?.back_link_id ?? investigatorCode;
    const backCard = metadata.cards[backCardCode];
    const baseDeckSize = backCard?.deck_requirements?.size ?? 30;

    // Calculate deck size adjustment from picked cards
    let deckSizeAdjustment = 0;
    for (const [code, quantity] of Object.entries(pickedCards)) {
      const card = metadata.cards[code];
      if (card?.deck_requirements?.size != null) {
        deckSizeAdjustment += card.deck_requirements.size * quantity;
      }
    }

    const targetDeckSize = baseDeckSize + deckSizeAdjustment;

    // Calculate current deck size excluding special cards (signatures, weaknesses, etc.)
    // Same logic as decodeSlots in slots.ts
    let currentDeckSize = 0;
    for (const [code, quantity] of Object.entries(pickedCards)) {
      const card = metadata.cards[code];
      if (card && !isSpecialCard(card)) {
        currentDeckSize += quantity;
      }
    }

    // Collect additional deck options from picked cards (like getAdditionalDeckOptions)
    const additionalDeckOptions: DeckOption[] = [];
    for (const [code, quantity] of Object.entries(pickedCards)) {
      const card = metadata.cards[code];
      if (card && card.type_code !== "investigator" && card.deck_options) {
        for (const _ of range(0, quantity)) {
          additionalDeckOptions.push(...card.deck_options);
        }
      }
    }

    if (currentDeckSize >= targetDeckSize) {
      set({
        draft: {
          ...draft,
          phase: "complete",
          currentOptions: [],
          targetDeckSize,
        },
      });
      return;
    }

    // Get available cards (filtered by faction limits and deck limits)
    // Include additional deck options from picked cards
    const availableCards = selectAvailableDraftCards(
      state,
      investigatorCode,
      pickedCards,
      additionalDeckOptions,
    );

    // Shuffle and take the required number of options
    const shuffled = shuffle([...availableCards]);
    const options = shuffled.slice(0, cardsPerPick).map((card) => card.code);

    set({
      draft: {
        ...draft,
        currentOptions: options,
        targetDeckSize,
      },
    });
  },

  pickDraftCard(code) {
    const state = get();
    assert(state.draft, "Draft must be initialized.");

    const { draft } = state;
    const currentQuantity = draft.pickedCards[code] ?? 0;

    set({
      draft: {
        ...draft,
        pickedCards: {
          ...draft.pickedCards,
          [code]: currentQuantity + 1,
        },
      },
    });

    // Generate new options after picking
    get().generateDraftOptions();
  },

  resetDraft() {
    set({ draft: undefined });
  },
});
