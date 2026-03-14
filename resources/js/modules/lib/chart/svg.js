/**
 * SVG container setup.
 */
import { select } from "../d3.js";

/**
 * Create the main SVG element within the container.
 *
 * @param {string} selector - CSS selector for the container element
 * @returns {d3.Selection} The SVG selection
 */
export function createSvg(selector) {
    const container = select(selector);
    const { width, height } = container.node().getBoundingClientRect();

    const svg = container
        .append("svg")
        .attr("width", width)
        .attr("height", height)
        .attr("viewBox", `0 0 ${width} ${height}`);

    // Main group that will be transformed by zoom/pan
    svg.append("g").attr("class", "full-diagram-canvas");

    return svg;
}

/**
 * Get the canvas group (the zoomable/pannable layer).
 *
 * @param {d3.Selection} svg
 * @returns {d3.Selection}
 */
export function getCanvas(svg) {
    return svg.select("g.full-diagram-canvas");
}

/**
 * Center the canvas on the root node.
 *
 * @param {d3.Selection} svg
 * @param {d3.ZoomBehavior} zoomBehavior
 */
export function centerOnRoot(svg, zoomBehavior) {
    const { width, height } = svg.node().getBoundingClientRect();

    const initialTransform = {
        x: width / 2,
        y: height / 2,
        k: 1,
    };

    svg.call(
        zoomBehavior.transform,
        () =>
            new DOMMatrix()
                .translate(initialTransform.x, initialTransform.y)
                .scale(initialTransform.k)
    );
}
