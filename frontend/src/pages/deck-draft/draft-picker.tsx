import { useTranslation } from "react-i18next";
import { CardScanControlled } from "@/components/card-scan";
import { useStore } from "@/store";
import { applyCardChanges } from "@/store/lib/card-edits";
import type { Card } from "@/store/schemas/card.schema";
import { selectMetadata } from "@/store/selectors/shared";
import { cardLevel } from "@/utils/card-utils";
import { getAccentColorsForFaction } from "@/utils/use-accent-color";
import css from "./deck-draft.module.css";

type Props = {
  options: string[];
  onPick: (code: string) => void;
};

export function DraftPicker(props: Props) {
  const { options, onPick } = props;
  const { t } = useTranslation();

  const metadata = useStore(selectMetadata);
  const tabooSetId = useStore((state) => state.draft?.tabooSetId);

  const cards = options
    .map((code) => metadata.cards[code])
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

  return (
    <div className={css["picker-container"]}>
      <div className={css["picker-header"]}>
        <h2>{t("deck_draft.picking.pick_card")}</h2>
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
      </ul>
    </div>
  );
}
