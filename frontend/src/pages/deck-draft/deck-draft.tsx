import { CheckIcon, RotateCcwIcon } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useLocation, useParams } from "wouter";
import { Footer } from "@/components/footer";
import { Masthead } from "@/components/masthead";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast.hooks";
import { useStore } from "@/store";
import { createDeck } from "@/store/lib/deck-factory";
import {
  selectMetadata,
  selectSettingsTabooId,
} from "@/store/selectors/shared";
import { displayAttribute, isSpecialCard } from "@/utils/card-utils";
import { cx } from "@/utils/cx";
import { useAccentColor } from "@/utils/use-accent-color";
import { useDocumentTitle } from "@/utils/use-document-title";
import { ErrorStatus } from "../errors/404";
import css from "./deck-draft.module.css";
import { DraftEditor } from "./draft-editor";
import { DraftPicker } from "./draft-picker";
import { DraftSetup } from "./draft-setup";

function DeckDraft() {
  const { code } = useParams<{ code: string }>();
  const { t } = useTranslation();
  const toast = useToast();
  const [, navigate] = useLocation();

  const metadata = useStore(selectMetadata);
  const settings = useStore((state) => state.settings);
  const draft = useStore((state) => state.draft);
  const initDraft = useStore((state) => state.initDraft);
  const startDraft = useStore((state) => state.startDraft);
  const pickDraftCard = useStore((state) => state.pickDraftCard);
  const resetDraft = useStore((state) => state.resetDraft);

  const investigator = metadata.cards[code];

  // Calculate deck size excluding special cards (same logic as decodeSlots)
  const currentDeckSize = draft
    ? (() => {
        let size = 0;
        for (const [cardCode, quantity] of Object.entries(draft.pickedCards)) {
          const card = metadata.cards[cardCode];
          if (card && !isSpecialCard(card)) {
            size += quantity;
          }
        }
        return size;
      })()
    : 0;

  // Clean up draft on unmount
  useEffect(() => {
    return () => {
      resetDraft();
    };
  }, [resetDraft]);

  useDocumentTitle(
    investigator
      ? `${t("deck_draft.title")}: ${displayAttribute(investigator, "name")}`
      : t("deck_draft.title"),
  );

  const accentColor = useAccentColor(investigator);

  const handleStart = useCallback(
    (cardsPerPick: number) => {
      const tabooSetId = selectSettingsTabooId(settings, metadata);
      initDraft(code, cardsPerPick, tabooSetId);
      startDraft();
    },
    [code, settings, metadata, initDraft, startDraft],
  );

  const handlePick = useCallback(
    (cardCode: string) => {
      pickDraftCard(cardCode);
    },
    [pickDraftCard],
  );

  const handleRestart = useCallback(() => {
    resetDraft();
  }, [resetDraft]);

  const handleSave = useCallback(() => {
    if (!draft || !investigator) return;

    const toastId = toast.show({
      children: t("deck_create.loading"),
      variant: "loading",
    });

    try {
      // Combine signature cards and picked cards
      const slots: Record<string, number> = {
        ...draft.signatureCards,
        ...draft.pickedCards,
      };

      // Create the deck
      const deck = createDeck({
        investigator_code: draft.investigatorCode,
        investigator_name: investigator.real_name,
        name: `${displayAttribute(investigator, "name")} (Draft)`,
        slots,
        meta: JSON.stringify({}),
        taboo_id: draft.tabooSetId ?? null,
        problem: null,
      });

      // Save to local storage
      const state = useStore.getState();
      useStore.setState({
        data: {
          ...state.data,
          decks: {
            ...state.data.decks,
            [deck.id]: deck,
          },
          history: {
            ...state.data.history,
            [deck.id]: [],
          },
        },
      });

      toast.dismiss(toastId);
      resetDraft();
      navigate(`/deck/edit/${deck.id}`, { replace: true });
    } catch (err) {
      toast.dismiss(toastId);
      toast.show({
        children: t("deck_create.error", { error: (err as Error).message }),
        variant: "error",
      });
    }
  }, [draft, investigator, toast, t, resetDraft, navigate]);

  if (!investigator || investigator.type_code !== "investigator") {
    return <ErrorStatus statusCode={404} />;
  }

  const phase = draft?.phase ?? "setup";

  const hasSidebar = phase !== "setup" && draft;

  return (
    <div
      className={cx(
        css["layout"],
        !hasSidebar && css["layout-no-sidebar"],
        "fade-in",
      )}
      style={accentColor}
    >
      <Masthead className={css["layout-header"]} />

      {hasSidebar && (
        <div className={css["layout-sidebar"]}>
          <DraftEditor
            investigatorCode={draft.investigatorCode}
            pickedCards={draft.pickedCards}
            signatureCards={draft.signatureCards}
            currentCount={currentDeckSize}
            targetCount={draft.targetDeckSize}
            investigatorName={investigator.real_name}
            tabooSetId={draft.tabooSetId ?? null}
          />
        </div>
      )}

      <div className={css["layout-content"]}>
        {phase === "setup" && (
          <DraftSetup investigator={investigator} onStart={handleStart} />
        )}

        {phase === "picking" && draft && (
          <DraftPicker options={draft.currentOptions} onPick={handlePick} />
        )}

        {phase === "complete" && draft && (
          <div className={css["complete-container"]}>
            <div className="longform">
              <h2>{t("deck_draft.complete.title")}</h2>
              <p>
                {t("deck_draft.picking.progress", {
                  current: currentDeckSize,
                  target: draft.targetDeckSize,
                })}
              </p>
            </div>

            <div className={css["complete-actions"]}>
              <Button variant="primary" size="lg" onClick={handleSave}>
                <CheckIcon />
                {t("deck_draft.complete.save")}
              </Button>
              <Button variant="bare" size="lg" onClick={handleRestart}>
                <RotateCcwIcon />
                {t("deck_draft.complete.restart")}
              </Button>
            </div>
          </div>
        )}
      </div>

      <footer className={css["layout-footer"]}>
        <Footer />
      </footer>
    </div>
  );
}

export default DeckDraft;
