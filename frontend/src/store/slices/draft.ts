import type { StateCreator } from "zustand";
import { assert } from "@/utils/assert";
import {
  countExperience,
  displayAttribute,
  isSpecialCard,
} from "@/utils/card-utils";
import { currentEnvironmentPacks } from "@/utils/environments";
import { range } from "@/utils/range";
import { shuffle } from "@/utils/shuffle";
import { applyCardChanges } from "../lib/card-edits";
import { resolveDeck } from "../lib/resolve-deck";
import type { DeckOption } from "../schemas/card.schema";
import { selectConnectionsData } from "../selectors/connections";
import {
  selectAvailableDraftCards,
  selectSignatureCards,
} from "../selectors/draft";
import {
  selectLocaleSortingCollator,
  selectLookupTables,
  selectMetadata,
  selectSettingsTabooId,
} from "../selectors/shared";
import type { StoreState } from ".";
import type { DraftSlice } from "./draft.types";

export const createDraftSlice: StateCreator<StoreState, [], [], DraftSlice> = (
  set,
  get,
) => ({
  draft: undefined,

  initDraft(investigatorCode, initialInvestigatorChoice) {
    set((state) => {
      const metadata = selectMetadata(state);
      const settings = state.settings;

      const investigator = metadata.cards[investigatorCode];
      assert(
        investigator && investigator.type_code === "investigator",
        "Draft must be initialized with an investigator card.",
      );

      const choice = initialInvestigatorChoice
        ? metadata.cards[initialInvestigatorChoice]
        : undefined;

      if (initialInvestigatorChoice) {
        assert(
          choice && choice.type_code === "investigator",
          "Draft must be initialized with an investigator card.",
        );

        assert(
          choice.real_name === investigator.real_name,
          "Parallel investigator must have the same real name as the investigator.",
        );
      }

      const connections = selectConnectionsData(state);
      const provider = settings.defaultStorageProvider;

      // when arkhamdb is set as default storage, but not available, default to local.
      const providerExists =
        provider !== "arkhamdb" ||
        connections.some((c) => c.provider === provider);

      // Apply current environment packs if default environment is set to "current"
      // This matches deck-create behavior - manual selections will override this
      const cardPool =
        settings.defaultEnvironment === "current"
          ? currentEnvironmentPacks(Object.values(metadata.cycles))
          : undefined;

      // Determine the back card code (where deck_requirements are defined)
      const backCardCode = choice
        ? choice.code
        : (investigator.back_link_id ?? investigatorCode);
      const backCard = metadata.cards[backCardCode];
      assert(backCard, "Back card must exist for investigator.");

      // Get signature cards using the back card code
      const signatureCards = selectSignatureCards(state, backCardCode);

      const baseDeckSize = backCard.deck_requirements?.size ?? 30;

      return {
        draft: {
          phase: "setup",
          investigatorCode,
          investigatorFrontCode: choice ? choice.code : investigator.code,
          investigatorBackCode: backCardCode,
          cardsPerPick: 5,
          pickedCards: {},
          signatureCards,
          currentOptions: [],
          targetDeckSize: baseDeckSize,
          tabooSetId: selectSettingsTabooId(settings, metadata),
          provider: providerExists ? provider : "local",
          title: `${displayAttribute(investigator, "name")} Draft`,
          selections: {},
          cardPool,
          mode: "new",
          remainingXp: 0,
          totalXp: 0,
        },
      };
    });
  },

  initUpgradeDraft(
    deckId,
    newXp,
    cardsPerPick,
    previousRemainingXp = 0,
    totalAvailableXp?: number,
  ) {
    set((state) => {
      const metadata = selectMetadata(state);
      const lookupTables = selectLookupTables(state);
      const collator = selectLocaleSortingCollator(state);

      const deck = state.data.decks[deckId];
      assert(deck, `Deck ${deckId} does not exist.`);

      // Resolve the deck to get investigator info
      const resolved = resolveDeck(
        {
          lookupTables,
          metadata,
          sharing: state.sharing,
        },
        collator,
        deck,
      );

      const investigator = resolved.investigatorFront.card;
      assert(
        investigator && investigator.type_code === "investigator",
        "Deck must have an investigator.",
      );

      // Use the base investigator code from the deck (not the resolved front card)
      const investigatorCode = deck.investigator_code;

      // Use the resolved front/back codes which already account for parallel selections
      const investigatorFrontCode = resolved.investigatorFront.card.code;
      const investigatorBackCode = resolved.investigatorBack.card.code;

      const backCard = metadata.cards[investigatorBackCode];
      assert(backCard, "Back card must exist for investigator.");

      // Get signature cards using the back card code (which may be parallel)
      const signatureCards = selectSignatureCards(state, investigatorBackCode);

      // Copy existing deck slots to pickedCards (excluding signatures)
      const pickedCards: Record<string, number> = {};
      for (const [code, quantity] of Object.entries(deck.slots)) {
        // Don't include signature cards in pickedCards
        if (!signatureCards[code]) {
          pickedCards[code] = quantity;
        }
      }

      const settings = state.settings;

      const connections = selectConnectionsData(state);
      const provider = settings.defaultStorageProvider;

      const providerExists =
        provider !== "arkhamdb" ||
        connections.some((c) => c.provider === provider);

      // Use card pool from the original deck if set, otherwise use default environment
      const cardPool = resolved.cardPool
        ? resolved.cardPool
        : settings.defaultEnvironment === "current"
          ? currentEnvironmentPacks(Object.values(metadata.cycles))
          : undefined;

      // Convert Selections (Record<string, Selection>) to draft format (Record<string, string>)
      const draftSelections: Record<string, string> = {};
      if (resolved.selections) {
        for (const [key, selection] of Object.entries(resolved.selections)) {
          if (selection.type === "deckSize") {
            draftSelections[key] = String(selection.value);
          } else if (selection.type === "faction") {
            if (selection.value) {
              draftSelections[key] = selection.value;
            }
          } else if (selection.type === "option") {
            if (selection.value?.id) {
              draftSelections[key] = selection.value.id;
            }
          }
        }
      }

      return {
        draft: {
          phase: "picking",
          investigatorCode,
          investigatorFrontCode,
          investigatorBackCode,
          cardsPerPick,
          pickedCards,
          signatureCards,
          currentOptions: [],
          targetDeckSize: 0, // Not used in upgrade mode
          tabooSetId: deck.taboo_id ?? undefined,
          provider: providerExists ? provider : "local",
          title: deck.name,
          selections: draftSelections,
          cardPool,
          sealed: resolved.sealedDeck,
          mode: "upgrade",
          upgradeDeckId: deckId,
          remainingXp: totalAvailableXp ?? newXp + previousRemainingXp, // Use total available for card pool filtering
          totalXp: newXp, // Only NEW XP (will be passed to upgradeDeck)
          previousRemainingXp, // Store old deck's remaining XP separately
          exileString: undefined,
        },
      };
    });

    // Generate initial options after initialization
    get().generateDraftOptions();
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
    const { pickedCards, cardsPerPick, investigatorBackCode } = draft;

    // Use investigatorBackCode for card pool selection since deck building rules are on the back card
    const metadata = selectMetadata(state);
    const backCard = metadata.cards[investigatorBackCode];
    const baseDeckSize = backCard?.deck_requirements?.size ?? 30;

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

    // For upgrade mode, check remaining XP instead of deck size
    if (draft.mode === "upgrade") {
      if (draft.remainingXp <= 0) {
        set({
          draft: {
            ...draft,
            phase: "complete",
            currentOptions: [],
          },
        });
        return;
      }

      // Get available cards (filtered by XP range and faction limits)
      const availableCards = selectAvailableDraftCards(
        state,
        investigatorBackCode,
        pickedCards,
        additionalDeckOptions,
      );

      // If no cards available (remaining XP too low), complete the draft
      if (availableCards.length === 0) {
        set({
          draft: {
            ...draft,
            phase: "complete",
            currentOptions: [],
          },
        });
        return;
      }

      // Shuffle and take the required number of options
      const shuffled = shuffle([...availableCards]);
      const options = shuffled.slice(0, cardsPerPick).map((card) => card.code);

      set({
        draft: {
          ...draft,
          currentOptions: options,
        },
      });
      return;
    }

    // Original logic for new draft mode
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
    // Use investigatorBackCode since deck building rules are on the back card
    // Note: selector expects 5 args: state, cardPoolFromState (extracted internally), investigatorCode, pickedCards, additionalDeckOptions
    // But reselect handles the internal extraction, so we pass: state, investigatorCode, pickedCards, additionalDeckOptions
    const availableCards = selectAvailableDraftCards(
      state,
      investigatorBackCode,
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
    const metadata = selectMetadata(state);
    let card = metadata.cards[code];
    assert(card, `Card ${code} must exist.`);

    // Apply taboo changes before calculating XP cost
    if (draft.tabooSetId) {
      card = applyCardChanges(card, metadata, draft.tabooSetId, undefined);
    }

    const currentQuantity = draft.pickedCards[code] ?? 0;

    // For upgrade mode, deduct XP cost
    let remainingXp = draft.remainingXp;
    if (draft.mode === "upgrade") {
      const xpCost = countExperience(card, 1);
      remainingXp = Math.max(0, draft.remainingXp - xpCost);
    }

    set({
      draft: {
        ...draft,
        pickedCards: {
          ...draft.pickedCards,
          [code]: currentQuantity + 1,
        },
        remainingXp,
      },
    });

    // Generate new options after picking
    get().generateDraftOptions();
  },

  resetDraft() {
    set({ draft: undefined });
  },

  draftSetTitle(value: string) {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");
      return {
        draft: {
          ...state.draft,
          title: value,
        },
      };
    });
  },

  draftSetTabooSet(value: number | undefined) {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");
      return {
        draft: {
          ...state.draft,
          tabooSetId: value,
        },
      };
    });
  },

  draftSetProvider(value) {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");
      return {
        draft: {
          ...state.draft,
          provider: value,
        },
      };
    });
  },

  draftSetInvestigatorCode(value: string, side?: "front" | "back") {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");

      if (!side) {
        return {
          draft: {
            ...state.draft,
            investigatorCode: value,
            investigatorFrontCode: value,
            investigatorBackCode: value,
            // Regenerate signature cards when back changes
            signatureCards: selectSignatureCards(state, value),
          },
        };
      }

      const path =
        side === "front" ? "investigatorFrontCode" : "investigatorBackCode";

      const updatedDraft = {
        ...state.draft,
        [path]: value,
      };

      // If back changed, regenerate signature cards and reset picked cards
      if (side === "back") {
        const metadata = selectMetadata(state);
        const backCard = metadata.cards[value];
        const baseDeckSize = backCard?.deck_requirements?.size ?? 30;

        return {
          draft: {
            ...updatedDraft,
            signatureCards: selectSignatureCards(state, value),
            targetDeckSize: baseDeckSize,
            // Reset picked cards since card pool changed
            pickedCards: {},
            currentOptions: [],
          },
        };
      }

      return {
        draft: updatedDraft,
      };
    });
  },

  draftSetSelection(key, value) {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");
      return {
        draft: {
          ...state.draft,
          selections: {
            ...state.draft.selections,
            [key]: value,
          },
        },
      };
    });
  },

  draftSetCardPool(value) {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");
      // When user manually sets card pool, it overrides default environment
      // Empty array [] means "no card pool filter" (all cards available) - set to null to distinguish from undefined
      // Array with items means filter to those packs
      // undefined means "use default environment from settings" (if set during init)
      return {
        draft: {
          ...state.draft,
          cardPool: value.length === 0 ? null : value,
        },
      };
    });
  },

  draftSetSealed(sealed) {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");
      return {
        draft: {
          ...state.draft,
          sealed,
        },
      };
    });
  },

  draftSetCardsPerPick(value) {
    set((state) => {
      assert(state.draft, "Draft must be initialized.");
      return {
        draft: {
          ...state.draft,
          cardsPerPick: value,
        },
      };
    });
  },
});
