import { useTranslation } from "react-i18next";
import { CardScanControlled } from "@/components/card-scan";
import { useStore } from "@/store";
import { applyCardChanges } from "@/store/lib/card-edits";
import { encodeCustomizations } from "@/store/lib/deck-meta";
import { resolveDeck } from "@/store/lib/resolve-deck";
import type { Card } from "@/store/schemas/card.schema";
import {
  selectLocaleSortingCollator,
  selectLookupTables,
  selectMetadata,
} from "@/store/selectors/shared";
import type { DraftOption } from "@/store/slices/draft.types";
import { cardLevel, isSpecialCard } from "@/utils/card-utils";
import { getAccentColorsForFaction } from "@/utils/use-accent-color";
import { CustomizationUpgradeCard } from "./customization-upgrade-card";
import css from "./deck-draft.module.css";

type Props = {
  options: DraftOption[];
  onPick: (code: string) => void;
  onPickCustomization: (cardCode: string, optionIndex: number) => void;
};

export function DraftPicker(props: Props) {
  const { options, onPick, onPickCustomization } = props;
  const { t } = useTranslation();

  const metadata = useStore(selectMetadata);
  const lookupTables = useStore(selectLookupTables);
  const collator = useStore(selectLocaleSortingCollator);
  const draft = useStore((state) => state.draft);
  const tabooSetId = draft?.tabooSetId;

  // Get resolved deck for customization upgrades (only in upgrade mode)
  // Create a temporary deck with customization upgrades merged for CustomizableSheet
  const resolvedDeck =
    draft?.mode === "upgrade" && draft.upgradeDeckId
      ? (() => {
          const state = useStore.getState();
          const deck = state.data.decks[draft.upgradeDeckId];
          if (!deck) return undefined;

          // Merge customization upgrades into deck meta
          const deckMeta = JSON.parse(deck.meta || "{}");
          const customizationUpgrades = draft.customizationUpgrades ?? {};

          // Convert customizationUpgrades to Customizations format
          const customizationsToMerge: Record<
            string,
            Record<number, { index: number; xp_spent: number }>
          > = {};
          for (const [cardCode, upgrades] of Object.entries(
            customizationUpgrades,
          )) {
            customizationsToMerge[cardCode] = {};
            for (const [indexStr, xpSpent] of Object.entries(upgrades)) {
              const index = Number.parseInt(indexStr, 10);
              customizationsToMerge[cardCode][index] = {
                index,
                xp_spent: xpSpent,
              };
            }
          }

          // Merge with existing customizations
          const existingResolved = resolveDeck(
            {
              lookupTables,
              metadata,
              sharing: state.sharing,
            },
            collator,
            deck,
          );
          const existingCustomizations = existingResolved.customizations ?? {};

          const mergedCustomizations = { ...existingCustomizations };
          for (const [cardCode, upgrades] of Object.entries(
            customizationsToMerge,
          )) {
            if (!mergedCustomizations[cardCode]) {
              mergedCustomizations[cardCode] = {};
            }
            for (const [indexStr, customization] of Object.entries(upgrades)) {
              const index = Number.parseInt(indexStr, 10);
              const existing = mergedCustomizations[cardCode][index];
              if (!existing || customization.xp_spent > existing.xp_spent) {
                mergedCustomizations[cardCode][index] = customization;
              }
            }
          }

          // Encode and merge into meta
          const encodedCustomizations =
            encodeCustomizations(mergedCustomizations);
          const mergedMeta = {
            ...deckMeta,
            ...encodedCustomizations,
          };

          // Create temporary deck with merged meta
          const tempDeck = {
            ...deck,
            meta: JSON.stringify(mergedMeta),
          };

          // Resolve the temporary deck
          return resolveDeck(
            {
              lookupTables,
              metadata,
              sharing: state.sharing,
            },
            collator,
            tempDeck,
          );
        })()
      : undefined;

  // Separate regular cards and customization options
  const regularCardOptions = options.filter(
    (opt): opt is Extract<DraftOption, { type: "card" }> => opt.type === "card",
  );
  const customizationOptions = options.filter(
    (opt): opt is Extract<DraftOption, { type: "customization" }> =>
      opt.type === "customization",
  );

  const cards = regularCardOptions
    .map((opt) => metadata.cards[opt.code])
    .filter((card): card is Card => !!card)
    .map((card) => {
      if (!tabooSetId) return card;
      const tabooCard = applyCardChanges(card, metadata, tabooSetId, undefined);
      // Ensure taboo_set_id is set on the card so CardScanControlled can use it for image loading
      // The taboo object should include taboo_set_id, but we ensure it's set explicitly
      if (
        !tabooCard.taboo_set_id &&
        metadata.taboos[`${card.code}-${tabooSetId}`]
      ) {
        tabooCard.taboo_set_id = tabooSetId;
      }
      return tabooCard;
    });

  // Calculate XP spent for upgrade mode
  // Calculate XP spent: total available XP - remaining XP
  // For display, show total XP spent (including previous remaining if any)
  const xpSpent =
    draft?.mode === "upgrade" && draft
      ? draft.totalXp + (draft.previousRemainingXp ?? 0) - draft.remainingXp
      : undefined;
  const totalXp =
    draft?.mode === "upgrade"
      ? draft.totalXp + (draft.previousRemainingXp ?? 0)
      : undefined;

  // Calculate number of cards added (excluding special cards)
  const cardsAdded = draft
    ? Object.entries(draft.pickedCards).reduce((total, [code, quantity]) => {
        const card = metadata.cards[code];
        if (card && !isSpecialCard(card)) {
          return total + quantity;
        }
        return total;
      }, 0)
    : 0;

  // Get target deck size for new draft mode
  const targetDeckSize =
    draft?.mode === "new" ? draft.targetDeckSize : undefined;

  return (
    <div className={css["picker-container"]}>
      <div className={css["picker-header"]}>
        <h2>
          {t("deck_draft.picking.pick_card")}
          {cardsAdded > 0 && (
            <span className={css["xp-counter"]}>
              {" "}
              ({cardsAdded}
              {targetDeckSize !== undefined ? `/${targetDeckSize}` : ""})
            </span>
          )}
          {xpSpent !== undefined && totalXp !== undefined && xpSpent > 0 && (
            <span className={css["xp-counter"]}>
              {" "}
              ({xpSpent}/{totalXp} XP)
            </span>
          )}
        </h2>
      </div>

      <ul className={css["picker-options"]}>
        {cards.map((card) => (
          <li key={card.code} className={css["picker-option"]}>
            <button
              type="button"
              className={css["option-trigger"]}
              onClick={() => onPick(card.code)}
              style={
                {
                  ...getAccentColorsForFaction(card),
                  "--level": cardLevel(card) ?? 0,
                } as React.CSSProperties
              }
            >
              <CardScanControlled
                card={card}
                flipped={false}
                hideFlipButton
                preventFlip
                draggable={false}
              />
            </button>
          </li>
        ))}
        {customizationOptions.map((opt) => {
          const card = metadata.cards[opt.cardCode];
          if (!card || !card.customization_options) return null;
          const option = card.customization_options[opt.optionIndex];
          if (!option) return null;

          return (
            <li
              key={`customization-${opt.cardCode}-${opt.optionIndex}`}
              className={css["picker-option"]}
            >
              <CustomizationUpgradeCard
                card={card}
                optionIndex={opt.optionIndex}
                option={option}
                deck={resolvedDeck}
                onPick={() =>
                  onPickCustomization(opt.cardCode, opt.optionIndex)
                }
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}
