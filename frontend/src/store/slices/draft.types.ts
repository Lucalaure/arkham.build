import type { StorageProvider } from "@/utils/constants";
import type { SealedDeck } from "../lib/types";

export type DraftPhase = "setup" | "picking" | "complete";

export type DraftState = {
  phase: DraftPhase;
  investigatorCode: string;
  investigatorFrontCode: string;
  investigatorBackCode: string;
  cardsPerPick: number;
  pickedCards: Record<string, number>;
  signatureCards: Record<string, number>;
  currentOptions: string[];
  targetDeckSize: number;
  tabooSetId: number | undefined;
  provider: StorageProvider;
  title: string;
  selections: {
    [key: string]: string;
  };
  cardPool?: string[] | null; // undefined = use default environment, null = explicitly cleared (no filter), array = manually selected packs
  sealed?: SealedDeck;
};

export type DraftSlice = {
  draft: DraftState | undefined;

  initDraft: (
    investigatorCode: string,
    initialInvestigatorChoice?: string,
  ) => void;
  draftSetTitle: (value: string) => void;
  draftSetTabooSet: (value: number | undefined) => void;
  draftSetProvider: (value: StorageProvider) => void;
  draftSetInvestigatorCode: (value: string, side?: "front" | "back") => void;
  draftSetSelection: (key: string, value: string) => void;
  draftSetCardPool: (value: string[]) => void;
  draftSetSealed: (payload: SealedDeck | undefined) => void;
  draftSetCardsPerPick: (value: number) => void;
  generateDraftOptions: () => void;
  pickDraftCard: (code: string) => void;
  resetDraft: () => void;
  startDraft: () => void;
};
