/**
 * Pan and zoom behavior via d3-zoom.
 */
import { zoom, zoomIdentity, select } from "../d3.js";
import { getCanvas } from "./svg.js";

/**
 * Initialize zoom behavior on the SVG element.
 *
 * @param {d3.Selection} svg
 * @returns {d3.ZoomBehavior}
 */
export function initZoom(svg) {
    const canvas = getCanvas(svg);

    const zoomBehavior = zoom()
        .scaleExtent([0.1, 4])
        .on("zoom", (event) => {
            canvas.attr("transform", event.transform);
        });

    svg.call(zoomBehavior);

    // Disable double-click zoom (we use click for navigation)
    svg.on("dblclick.zoom", null);

    return zoomBehavior;
}

/**
 * Create zoom control buttons.
 *
 * @param {string} containerSelector
 * @param {d3.Selection} svg
 * @param {d3.ZoomBehavior} zoomBehavior
 */
export function createZoomControls(containerSelector, svg, zoomBehavior) {
    const container = select(containerSelector);

    const controls = container
        .append("div")
        .attr("class", "zoom-controls");

    controls
        .append("button")
        .attr("type", "button")
        .attr("title", "Zoom in")
        .text("+")
        .on("click", () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 1.3));

    controls
        .append("button")
        .attr("type", "button")
        .attr("title", "Zoom out")
        .text("\u2212")
        .on("click", () => svg.transition().duration(300).call(zoomBehavior.scaleBy, 0.7));

    controls
        .append("button")
        .attr("type", "button")
        .attr("title", "Reset view")
        .text("\u21BA")
        .on("click", () => {
            const { width, height } = svg.node().getBoundingClientRect();
            svg.transition()
                .duration(500)
                .call(
                    zoomBehavior.transform,
                    zoomIdentity.translate(width / 2, height / 2)
                );
        });
}
