import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { DecklistGroup } from "@/components/decklist/decklist-groups";
import { DecklistSection } from "@/components/decklist/decklist-section";
import { Scroller } from "@/components/ui/scroller";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { InvestigatorListcard } from "@/pages/deck-edit/editor/investigator-listcard";
import { useStore } from "@/store";
import { createDeck } from "@/store/lib/deck-factory";
import type { DeckGrouping } from "@/store/lib/deck-grouping";
import { resolveDeck } from "@/store/lib/resolve-deck";
import type { ResolvedDeck } from "@/store/lib/types";
import { selectDeckGroups } from "@/store/selectors/decks";
import {
  selectLocaleSortingCollator,
  selectLookupTables,
  selectMetadata,
} from "@/store/selectors/shared";
import { displayAttribute, getCardColor } from "@/utils/card-utils";
import { cx } from "@/utils/cx";
import { useAccentColor } from "@/utils/use-accent-color";
import css from "./draft-editor.module.css";

type Props = {
  investigatorCode: string;
  pickedCards: Record<string, number>;
  signatureCards: Record<string, number>;
  currentCount: number;
  targetCount: number;
  investigatorName: string;
  tabooSetId: number | null;
};

export function DraftEditor(props: Props) {
  const {
    investigatorCode,
    pickedCards,
    signatureCards,
    investigatorName,
    tabooSetId,
  } = props;
  const { t } = useTranslation();

  const metadata = useStore(selectMetadata);
  const lookupTables = useStore(selectLookupTables);
  const collator = useStore(selectLocaleSortingCollator);
  const settings = useStore((state) => state.settings);

  const investigator = metadata.cards[investigatorCode];

  // Create a temporary deck structure to use with existing components
  const draftDeck = useMemo(() => {
    if (!investigator) return null;

    // Combine signature cards and picked cards
    const slots: Record<string, number> = {
      ...signatureCards,
      ...pickedCards,
    };

    // Create a minimal deck
    const deck = createDeck({
      investigator_code: investigatorCode,
      investigator_name: investigatorName,
      name: `${displayAttribute(investigator, "name")} (Draft)`,
      slots,
      meta: JSON.stringify({}),
      taboo_id: tabooSetId ?? null,
      problem: null,
    });

    // Resolve the deck to get ResolvedDeck structure
    try {
      return resolveDeck(
        { metadata, lookupTables, sharing: { decks: {} } },
        collator,
        deck,
      );
    } catch {
      return null;
    }
  }, [
    investigator,
    investigatorCode,
    investigatorName,
    pickedCards,
    signatureCards,
    tabooSetId,
    metadata,
    lookupTables,
    collator,
  ]);

  // Calculate deck stats manually for draft (before early return)
  const deckStats = useMemo(() => {
    let deckSize = 0;
    let deckSizeTotal = 0;

    for (const [code, quantity] of Object.entries(pickedCards)) {
      const card = metadata.cards[code];
      if (card) {
        deckSizeTotal += quantity;
        if (
          !card.encounter_code &&
          !card.subtype_code &&
          card.xp != null &&
          !card.permanent
        ) {
          deckSize += quantity;
        }
      }
    }

    // Add signature cards to total but not to deck size
    for (const [code, quantity] of Object.entries(signatureCards)) {
      const card = metadata.cards[code];
      if (card) {
        deckSizeTotal += quantity;
      }
    }

    return {
      deckSize,
      deckSizeTotal,
      xpRequired: 0,
    };
  }, [pickedCards, signatureCards, metadata]);

  // Create a modified ResolvedDeck with draft stats
  const draftDeckWithStats = useMemo((): ResolvedDeck | null => {
    if (!draftDeck) return null;
    return {
      ...draftDeck,
      stats: {
        ...draftDeck.stats,
        deckSize: deckStats.deckSize,
        deckSizeTotal: deckStats.deckSizeTotal,
        xpRequired: 0,
      },
    };
  }, [draftDeck, deckStats]);

  // Calculate accent colors (hooks must be called unconditionally)
  // Use investigator card for accent color if draftDeckWithStats is not ready
  const cardForAccent =
    draftDeckWithStats?.investigatorBack.card ?? investigator;
  const cssVariables = useAccentColor(cardForAccent);
  const backgroundCls = draftDeckWithStats
    ? getCardColor(draftDeckWithStats.investigatorBack.card, "background")
    : getCardColor(investigator, "background");

  // Get deck groups for display (must be called before early return)
  const groups = useStore((state) =>
    draftDeckWithStats
      ? selectDeckGroups(state, draftDeckWithStats, settings.lists.deck)
      : null,
  );

  if (!investigator || !draftDeckWithStats) {
    return null;
  }

  return (
    <div className={css["editor"]} style={cssVariables} data-testid="editor">
      <header className={cx(css["editor-header"], backgroundCls)}>
        <h1 className={css["editor-title"]}>
          {displayAttribute(investigator, "name")} (Draft)
        </h1>
        <DraftStats
          deckSize={deckStats.deckSize}
          deckSizeTotal={deckStats.deckSizeTotal}
        />
      </header>

      <InvestigatorListcard deck={draftDeckWithStats} />

      <Tabs className={css["editor-tabs"]} value="slots">
        <TabsList className={css["editor-tabs-list"]}>
          <TabsTrigger value="slots">
            <span>{t("common.decks.slots")}</span>
          </TabsTrigger>
        </TabsList>

        <Scroller className={css["editor-tabs-content"]}>
          <TabsContent value="slots" data-testid="editor-tabs-slots">
            <EditorGroup
              deck={draftDeckWithStats}
              grouping={groups?.slots}
              title={t("common.decks.slots")}
            />

            {groups?.bondedSlots && (
              <EditorGroup
                deck={draftDeckWithStats}
                grouping={groups.bondedSlots}
                omitEmpty
                showTitle
                title={t("common.decks.bondedSlots")}
              />
            )}
          </TabsContent>
        </Scroller>
      </Tabs>
    </div>
  );
}

function DraftStats(props: { deckSize: number; deckSizeTotal: number }) {
  const { deckSize, deckSizeTotal } = props;

  return (
    <div className={css["stats"]}>
      <strong data-testid="deck-summary-size">
        <i className="icon-card-outline-bold" />× {deckSize} ({deckSizeTotal})
      </strong>
    </div>
  );
}

function EditorGroup(props: {
  deck: ResolvedDeck;
  title: string;
  showTitle?: boolean;
  grouping?: DeckGrouping;
  omitEmpty?: boolean;
}) {
  const { deck, omitEmpty, grouping, showTitle, title } = props;

  const { t } = useTranslation();
  const isEmpty = !grouping?.data?.length;

  if (omitEmpty && isEmpty) return null;

  return (
    <DecklistSection showTitle={showTitle} title={title}>
      {isEmpty ? (
        <div className={css["editor-placeholder"]}>
          {t("common.no_entries")}
        </div>
      ) : (
        grouping && <DecklistGroup deck={deck} grouping={grouping} />
      )}
    </DecklistSection>
  );
}
