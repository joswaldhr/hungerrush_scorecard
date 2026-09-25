import { exportDataDetails, type ExportSnapshot } from "./domain/metrics/export-snapshot";

// Freeze the DOM synchronously, before loading canvas/PDF libraries. Navigation
// can replace the live scorecard without changing the pending export.
export function freezeScorecardCapture(source: HTMLElement, snapshot: ExportSnapshot) {
  const container = document.createElement("div");
  container.setAttribute("aria-hidden", "true");
  const styles = getComputedStyle(source);
  Object.assign(container.style, {
    position: "absolute",
    left: "-100000px",
    top: "0",
    padding: "24px",
    width: `${Math.max(source.getBoundingClientRect().width, 600) + 48}px`,
    color: styles.color,
    fontFamily: styles.fontFamily,
    backgroundColor: getComputedStyle(document.body).backgroundColor,
  });
  const heading = document.createElement("h1");
  heading.textContent = snapshot.employeeName;
  heading.style.fontSize = "24px";
  const period = document.createElement("p");
  period.textContent = `${snapshot.periodLabel} • Comparison: ${snapshot.previousPeriodLabel} • Reporting timezones are listed in data details.`;
  period.style.marginBottom = "20px";
  const clone = source.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id");
  clone.querySelectorAll("[id]").forEach((element) => element.removeAttribute("id"));
  const details = document.createElement("p");
  details.textContent = `Data details\n${exportDataDetails(snapshot.metrics)}`;
  Object.assign(details.style, { whiteSpace: "pre-wrap", fontSize: "11px", marginTop: "20px" });
  container.append(heading, period, clone, details);
  document.body.append(container);
  return { element: container, dispose: () => container.remove() };
}
