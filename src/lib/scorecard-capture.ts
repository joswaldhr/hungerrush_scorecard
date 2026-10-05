import { exportReviewNotes, type ExportSnapshot } from "./domain/metrics/export-snapshot";

// Freeze the DOM synchronously, before loading canvas/PDF libraries. Navigation
// can replace the live scorecard without changing the pending export.
export function freezeScorecardCapture(source: HTMLElement, snapshot: ExportSnapshot) {
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  const styles = getComputedStyle(source);
  // The live tables can scroll in a narrow panel. Give the frozen export enough
  // room for every column instead of capturing only the visible scroll viewport.
  const contentWidth = Math.max(source.getBoundingClientRect().width, source.scrollWidth, 1024);
  Object.assign(container.style, {
    position: "absolute",
    left: "-100000px",
    top: "0",
    padding: "24px",
    boxSizing: "border-box",
    width: `${contentWidth + 48}px`,
    color: styles.color,
    fontFamily: styles.fontFamily,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
  });
  const heading = document.createElement("h1");
  heading.textContent = snapshot.employeeName;
  heading.style.fontSize = "24px";
  const period = document.createElement("p");
  period.textContent = `${snapshot.periodLabel} • Comparison: ${snapshot.previousPeriodLabel}`;
  period.style.marginBottom = "20px";
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  const details = document.createElement("p");
  details.textContent = exportReviewNotes(snapshot.metrics);
  Object.assign(details.style, {
    whiteSpace: "pre-wrap",
    fontSize: "12px",
    lineHeight: "1.6",
    marginTop: "20px",
    paddingTop: "16px",
    borderTop: "1px solid",
  });
  container.append(heading, period, clone, details);
  document.body.append(container);
  return { element: container, dispose: () => container.remove() };
}
