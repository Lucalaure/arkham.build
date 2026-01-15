import { useTranslation } from "react-i18next";
import { CardScanControlled } from "@/components/card-scan";
import { useStore } from "@/store";
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

  const cards = options
    .map((code) => metadata.cards[code])
    .filter((card): card is Card => !!card);

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
