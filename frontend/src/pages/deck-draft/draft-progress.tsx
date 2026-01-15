import { useTranslation } from "react-i18next";
import { useStore } from "@/store";
import type { Card } from "@/store/schemas/card.schema";
import { selectMetadata } from "@/store/selectors/shared";
import { displayAttribute } from "@/utils/card-utils";
import { SPECIAL_CARD_CODES } from "@/utils/constants";
import { getAccentColorsForFaction } from "@/utils/use-accent-color";
import css from "./deck-draft.module.css";

type Props = {
  pickedCards: Record<string, number>;
  signatureCards: Record<string, number>;
  currentCount: number;
  targetCount: number;
};

export function DraftProgress(props: Props) {
  const { pickedCards, signatureCards, currentCount, targetCount } = props;
  const { t } = useTranslation();

  const metadata = useStore(selectMetadata);

  // Convert picked cards to sorted list
  const pickedList = Object.entries(pickedCards)
    .filter(([, qty]) => qty > 0)
    .map(([code, quantity]) => ({
      card: metadata.cards[code],
      quantity,
    }))
    .filter((entry): entry is { card: Card; quantity: number } => !!entry.card)
    .sort((a, b) =>
      displayAttribute(a.card, "name").localeCompare(
        displayAttribute(b.card, "name"),
      ),
    );

  // Separate signature cards from random basic weakness
  const signatureList = Object.entries(signatureCards)
    .filter(
      ([code, qty]) =>
        qty > 0 && code !== SPECIAL_CARD_CODES.RANDOM_BASIC_WEAKNESS,
    )
    .map(([code, quantity]) => ({
      card: metadata.cards[code],
      quantity,
    }))
    .filter((entry): entry is { card: Card; quantity: number } => !!entry.card)
    .sort((a, b) =>
      displayAttribute(a.card, "name").localeCompare(
        displayAttribute(b.card, "name"),
      ),
    );

  const randomBasicWeaknessCount =
    signatureCards[SPECIAL_CARD_CODES.RANDOM_BASIC_WEAKNESS] ?? 0;

  return (
    <div className={css["progress-container"]}>
      <div className={css["progress-stats"]}>
        <div>
          <strong>{t("common.decks.slots")}:</strong> {currentCount} /{" "}
          {targetCount}
        </div>
        {signatureList.length > 0 && (
          <div>
            <strong>Signature Cards:</strong> {signatureList.length}
          </div>
        )}
        {randomBasicWeaknessCount > 0 && (
          <div>
            <strong>{t("deck_create.random_basic_weakness")}:</strong>{" "}
            {randomBasicWeaknessCount}
          </div>
        )}
      </div>

      {signatureList.length > 0 && (
        <>
          <h4>Signature Cards</h4>
          <ul className={css["progress-cards"]}>
            {signatureList.map(({ card, quantity }) => (
              <li
                key={card.code}
                className={css["progress-card"]}
                style={getAccentColorsForFaction(card)}
              >
                <span className={css["progress-card-quantity"]}>
                  {quantity}
                </span>
                <span className={css["progress-card-name"]}>
                  {displayAttribute(card, "name")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}

      {pickedList.length > 0 && (
        <>
          <h4>{t("common.decks.slots")}</h4>
          <ul className={css["progress-cards"]}>
            {pickedList.map(({ card, quantity }) => (
              <li
                key={card.code}
                className={css["progress-card"]}
                style={getAccentColorsForFaction(card)}
              >
                <span className={css["progress-card-quantity"]}>
                  {quantity}
                </span>
                <span className={css["progress-card-name"]}>
                  {displayAttribute(card, "name")}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
