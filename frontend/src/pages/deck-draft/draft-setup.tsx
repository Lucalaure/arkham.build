import { DicesIcon } from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { CardScan } from "@/components/card-scan";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel } from "@/components/ui/field";
import { useStore } from "@/store";
import type { Card } from "@/store/schemas/card.schema";
import { selectCanStartDraft } from "@/store/selectors/draft";
import { displayAttribute } from "@/utils/card-utils";
import css from "./deck-draft.module.css";

type Props = {
  investigator: Card;
  onStart: (cardsPerPick: number) => void;
};

export function DraftSetup(props: Props) {
  const { investigator, onStart } = props;
  const { t } = useTranslation();

  const [cardsPerPick, setCardsPerPick] = useState(5);

  const { canStart, required, available } = useStore((state) =>
    selectCanStartDraft(state, investigator.code),
  );

  const handleSubmit = (evt: React.FormEvent) => {
    evt.preventDefault();
    if (canStart) {
      onStart(cardsPerPick);
    }
  };

  return (
    <div className={css["setup-container"]}>
      <div className={css["investigator-card"]}>
        <CardScan card={investigator} />
      </div>

      <div className="longform">
        <h2>
          {t("deck_draft.title")}: {displayAttribute(investigator, "name")}
        </h2>
      </div>

      {!canStart && (
        <div className={css["error-message"]}>
          {t("deck_draft.setup.insufficient_cards", { required, available })}
        </div>
      )}

      <form className={css["setup-form"]} onSubmit={handleSubmit}>
        <Field full>
          <FieldLabel htmlFor="cards-per-pick">
            {t("deck_draft.setup.cards_per_pick")}
          </FieldLabel>
          <select
            id="cards-per-pick"
            value={cardsPerPick}
            onChange={(evt) => setCardsPerPick(Number(evt.target.value))}
          >
            <option value={3}>3</option>
            <option value={5}>5</option>
            <option value={10}>10</option>
          </select>
        </Field>

        <div className={css["setup-actions"]}>
          <Button type="submit" variant="primary" disabled={!canStart}>
            <DicesIcon />
            {t("deck_draft.setup.start")}
          </Button>
        </div>
      </form>
    </div>
  );
}
