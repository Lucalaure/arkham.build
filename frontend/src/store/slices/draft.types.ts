export type DraftPhase = "setup" | "picking" | "complete";

export type DraftState = {
  phase: DraftPhase;
  investigatorCode: string;
  cardsPerPick: number;
  pickedCards: Record<string, number>;
  signatureCards: Record<string, number>;
  currentOptions: string[];
  targetDeckSize: number;
  tabooSetId: number | undefined;
};

export type DraftSlice = {
  draft: DraftState | undefined;

  initDraft: (
    investigatorCode: string,
    cardsPerPick: number,
    tabooSetId: number | undefined,
  ) => void;
  generateDraftOptions: () => void;
  pickDraftCard: (code: string) => void;
  resetDraft: () => void;
  startDraft: () => void;
};
