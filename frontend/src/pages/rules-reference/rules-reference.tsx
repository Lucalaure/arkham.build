/** biome-ignore-all lint/security/noDangerouslySetInnerHtml: trusted content. */
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/layouts/app-layout";
import { parseCardTextHtml } from "@/utils/card-utils";
import "./rules-reference.css";
import { ChevronLeftIcon, ChevronUpIcon, ListIcon, XIcon } from "lucide-react";
import { useCallback, useState } from "react";
import html from "@/assets/rules.html?raw";
import { Button } from "@/components/ui/button";
import { Scroller } from "@/components/ui/scroller";
import { cx } from "@/utils/cx";
import { useGoBack } from "@/utils/use-go-back";

function RulesReference() {
  const { t } = useTranslation();
  const [tocOpen, setTocOpen] = useState(false);

  const goBack = useGoBack();

  const onBackToTop = useCallback(() => {
    window.scrollTo({ top: 0, behavior: "auto" });
  }, []);

  const onToggleToc = useCallback(() => {
    setTocOpen((prev) => !prev);
  }, []);

  const onCloseToc = useCallback(() => {
    setTocOpen(false);
  }, []);

  const [toc, rules] = html.split("<!-- BEGIN RULES -->");

  return (
    <AppLayout title={t("rules.title")}>
      <div className="container">
        <Button
          className="toc-toggle"
          onClick={onToggleToc}
          size="xl"
          variant="primary"
        >
          {tocOpen ? <XIcon /> : <ListIcon />} {t("rules.toc")}
        </Button>
        <div className={cx("toc-container", tocOpen && "open")}>
          <h1 className="toc-title">{t("rules.toc")}</h1>

          <nav className="toc-nav">
            <Button size="sm" onClick={goBack}>
              <ChevronLeftIcon />
              {t("common.back")}
            </Button>
            <Button size="sm" onClick={onBackToTop}>
              <ChevronUpIcon />
              {t("rules.back_to_top")}
            </Button>
          </nav>

          <Scroller className="toc-inner" onClick={onCloseToc}>
            <div
              dangerouslySetInnerHTML={{
                __html: parseCardTextHtml(toc, { newLines: "skip" }),
              }}
            />
          </Scroller>
        </div>
        <div
          className="rules-container"
          dangerouslySetInnerHTML={{
            __html: parseCardTextHtml(rules, { newLines: "skip" }),
          }}
        />
      </div>
    </AppLayout>
  );
}

export default RulesReference;
