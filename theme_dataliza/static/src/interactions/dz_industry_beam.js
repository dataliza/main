import { Interaction } from "@web/public/interaction";
import { registry } from "@web/core/registry";

// "Card Beam" for the industries row, after blacklead-studio's CodePen (https://codepen.io/blacklead-studio/pen/xbwaqxE,
// listed on freefrontend). A strip of cards slides right to left through a vertical beam at the centre.
// Every card has two stacked faces: the real card (--clip-right hides the part already crossed) and a block of
// pseudo-code (--clip-left reveals it), so each card turns into code as it crosses the beam. The pen draws the glowing
// particles with three.js; here a single 2D canvas does it. Without JS, or with prefers-reduced-motion, the markup
// stays a static wrapping grid of the front faces (the stylesheet only goes live under the `is-live` class).

// <core>
function createCardBeam(host, options) {
    const opts = Object.assign(
        {
            speed: 60, // px per second, right to left
            beamHalfWidth: 4, // px, same hit area as the pen (centre -4 / +4)
            maxParticles: 160,
            emitRate: 110, // particles per second while a card crosses the beam
            codeInterval: 400, // ms between code refreshes
            codeCards: 2, // visible cards refreshed per tick
            codeLines: 13,
        },
        options
    );
    const noop = { destroy() {} };
    const track = host.querySelector(".s_dz_features__beam-track");
    const canvas = host.querySelector(".s_dz_features__beam-fx");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const originals = track
        ? Array.from(track.children).filter((el) => el.classList.contains("s_dz_features__ic"))
        : [];
    const ctx = canvas && canvas.getContext ? canvas.getContext("2d") : null;
    if (!track || !ctx || !originals.length || reducedMotion.matches) {
        return noop;
    }

    // Pseudo-code library (Odoo / ERP flavoured, generic, no real data).
    const LIB = [
        "def action_confirm(self):",
        "partner_id = fields.Many2one('res.partner')",
        '<field name="state" widget="statusbar"/>',
        "for line in self.order_line:",
        "    line.price_subtotal = qty * price",
        "SELECT id, name FROM res_partner",
        "WHERE active = TRUE ORDER BY name;",
        "return self.write({'state': 'done'})",
        "@api.depends('order_line.price_total')",
        "class SaleOrder(models.Model):",
        "    _inherit = 'sale.order'",
        "amount_total = fields.Monetary()",
        "if not self.env.user.has_group(g):",
        "    raise UserError(_('Sin acceso'))",
        "records = self.search([('state', '=', 'sale')])",
        "<record id=\"view_form\" model=\"ir.ui.view\">",
        '<button name="action_post" type="object"/>',
        "self.env['stock.move'].create(vals)",
        "UPDATE stock_quant SET quantity = 0;",
        "date_order = fields.Datetime(default=now)",
        "products.mapped('list_price')",
        "env.cr.execute(query, params)",
        "return {'type': 'ir.actions.act_window'}",
        "JOIN account_move am ON am.id = l.move_id",
        "name = fields.Char(required=True)",
        "super().create(vals_list)",
        "_sql_constraints = []",
        "x = len(ids)",
        "ok = True",
        "# etl: extract, transform, load",
        "GROUP BY company_id;",
        "</tree>",
        "pass",
    ];
    const INDENTS = ["", "    ", "        "];
    const COLORS = ["#00ff66", "#ffffff", "#00e5ff"];
    const SCAN_ANIMATION = "s_dz_features_ic_scan";
    const MAX = Math.max(1, opts.maxParticles | 0);

    // Particle pool: fixed typed arrays, recycled as a ring, nothing allocated per frame.
    const px = new Float32Array(MAX);
    const py = new Float32Array(MAX);
    const pvx = new Float32Array(MAX);
    const pvy = new Float32Array(MAX);
    const plife = new Float32Array(MAX);
    const pmax = new Float32Array(MAX);
    const psize = new Float32Array(MAX);
    const pcol = new Uint8Array(MAX);
    let head = 0;
    let alive = 0;
    let dirty = false; // something is painted on the canvas

    const clones = [];
    const groupText = [];
    let items = [];
    let W = 0;
    let H = 0;
    let cx = 0;
    let cycle = 0;
    let pos = 0; // px travelled, wraps at `cycle`
    let sized = false;
    let inView = typeof IntersectionObserver === "undefined";
    let hovering = false;
    let destroyed = false;
    let raf = 0;
    let last = 0;
    let emitAcc = 0;
    let codeAcc = 0;

    function makeCode() {
        let out = "";
        for (let i = 0; i < opts.codeLines; i++) {
            out += INDENTS[(Math.random() * INDENTS.length) | 0] + LIB[(Math.random() * LIB.length) | 0] + "\n";
        }
        return out;
    }

    function setGroup(group, text) {
        groupText[group] = text;
        for (let i = 0; i < items.length; i++) {
            if (items[i].group === group && items[i].code) {
                items[i].code.textContent = text;
            }
        }
    }

    function buildItems() {
        items = Array.from(track.children).map((el, i) => ({
            el,
            front: el.querySelector(".s_dz_features__ic-front"),
            code: el.querySelector(".s_dz_features__ic-code"),
            group: i % originals.length,
            left: 0,
            width: 0,
            state: -1, // -1 unknown, 0 not reached, 1 crossing, 2 crossed
        }));
        for (let g = 0; g < originals.length; g++) {
            if (groupText[g] === undefined) {
                groupText[g] = makeCode();
            }
        }
        for (let i = 0; i < items.length; i++) {
            if (items[i].code) {
                items[i].code.textContent = groupText[items[i].group];
            }
        }
    }

    function measure() {
        if (destroyed) {
            return;
        }
        W = host.clientWidth;
        H = host.clientHeight;
        const firstRect = originals[0].getBoundingClientRect();
        const lastRect = originals[originals.length - 1].getBoundingClientRect();
        const gap = parseFloat(getComputedStyle(track).columnGap) || 0;
        cycle = lastRect.right - firstRect.left + gap;
        sized = W > 0 && H > 0 && cycle > 0 && firstRect.width > 0;
        if (!sized) {
            sync();
            return;
        }
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        const cw = Math.round(W * dpr);
        const ch = Math.round(H * dpr);
        if (canvas.width !== cw || canvas.height !== ch) {
            canvas.width = cw;
            canvas.height = ch;
        }
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.globalCompositeOperation = "lighter";
        cx = W / 2;

        // the strip must be wider than the host plus one cycle so the loop never shows a gap
        const copies = Math.ceil(W / cycle) + 1;
        let added = false;
        while (track.children.length < copies * originals.length) {
            for (let i = 0; i < originals.length; i++) {
                const clone = originals[i].cloneNode(true);
                clone.setAttribute("aria-hidden", "true");
                clone.removeAttribute("role");
                track.appendChild(clone);
                clones.push(clone);
            }
            added = true;
        }
        if (added || items.length !== track.children.length) {
            buildItems();
        }
        const trackRect = track.getBoundingClientRect();
        for (let i = 0; i < items.length; i++) {
            const rect = items[i].el.getBoundingClientRect();
            items[i].left = rect.left - trackRect.left;
            items[i].width = rect.width;
            items[i].state = -1;
        }
        pos %= cycle;
        sync();
    }

    function spawn() {
        const i = head;
        head = (head + 1) % MAX;
        if (plife[i] <= 0) {
            alive++;
        }
        const scatter = Math.random() < 0.2;
        px[i] = cx + (Math.random() - 0.5) * 3;
        py[i] = Math.random() * H;
        pvx[i] = scatter ? -10 - Math.random() * 50 : 20 + Math.random() * 130;
        pvy[i] = (Math.random() - 0.5) * 60;
        pmax[i] = plife[i] = 0.5 + Math.random() * 0.7;
        psize[i] = 0.8 + Math.random() * 1.6;
        pcol[i] = Math.random() < 0.6 ? 0 : Math.random() < 0.5 ? 1 : 2;
    }

    function drawParticles(dt) {
        for (let i = 0; i < MAX; i++) {
            if (plife[i] > 0) {
                plife[i] -= dt;
                if (plife[i] <= 0) {
                    alive--;
                    continue;
                }
                px[i] += pvx[i] * dt;
                py[i] += pvy[i] * dt;
            }
        }
        if (alive <= 0 && !dirty) {
            return;
        }
        ctx.clearRect(0, 0, W, H);
        dirty = alive > 0;
        for (let c = 0; c < COLORS.length; c++) {
            ctx.fillStyle = COLORS[c];
            for (let i = 0; i < MAX; i++) {
                if (plife[i] > 0 && pcol[i] === c) {
                    ctx.globalAlpha = plife[i] / pmax[i];
                    ctx.beginPath();
                    ctx.arc(px[i], py[i], psize[i], 0, 6.2832);
                    ctx.fill();
                }
            }
        }
        ctx.globalAlpha = 1;
    }

    function refreshCode() {
        // swap the code of a couple of cards that are on screen (not all of them: cheaper)
        for (let n = 0; n < opts.codeCards; n++) {
            const item = items[(Math.random() * items.length) | 0];
            const l = item.left - pos;
            if (l < W && l + item.width > 0) {
                setGroup(item.group, makeCode());
            }
        }
    }

    function frame(now) {
        raf = requestAnimationFrame(frame);
        const dt = Math.min(Math.max((now - last) / 1000, 0), 0.1);
        last = now;
        pos += opts.speed * dt;
        if (pos >= cycle) {
            pos -= cycle;
        }
        track.style.transform = "translate3d(" + -pos + "px,0,0)";

        const beamL = cx - opts.beamHalfWidth;
        const beamR = cx + opts.beamHalfWidth;
        let crossing = 0;
        for (let i = 0; i < items.length; i++) {
            const item = items[i];
            const l = item.left - pos;
            const r = l + item.width;
            const state = r < beamL ? 2 : l > beamR ? 0 : 1;
            if (state === 1) {
                crossing++;
                if (item.state === 0) {
                    item.el.classList.add("is-scan");
                }
                if (item.front) {
                    item.front.style.setProperty("--clip-right", (Math.max(beamL - l, 0) / item.width) * 100 + "%");
                }
                if (item.code) {
                    item.code.style.setProperty(
                        "--clip-left",
                        (Math.min(beamR - l, item.width) / item.width) * 100 + "%"
                    );
                }
            } else if (state !== item.state) {
                const v = state === 2 ? "100%" : "0%";
                if (item.front) {
                    item.front.style.setProperty("--clip-right", v);
                }
                if (item.code) {
                    item.code.style.setProperty("--clip-left", v);
                }
            }
            item.state = state;
        }

        if (crossing > 0) {
            emitAcc += opts.emitRate * dt;
            while (emitAcc >= 1) {
                emitAcc -= 1;
                spawn();
            }
        } else {
            emitAcc = 0;
        }
        drawParticles(dt);

        codeAcc += dt * 1000;
        if (codeAcc >= opts.codeInterval) {
            codeAcc = 0;
            refreshCode();
        }
    }

    function sync() {
        const should = !destroyed && sized && inView && !hovering && !document.hidden;
        if (should && !raf) {
            last = performance.now();
            raf = requestAnimationFrame(frame);
        } else if (!should && raf) {
            cancelAnimationFrame(raf);
            raf = 0;
        }
    }

    const onEnter = (event) => {
        if (event.pointerType === "mouse") {
            hovering = true;
            sync();
        }
    };
    const onLeave = (event) => {
        if (event.pointerType === "mouse") {
            hovering = false;
            sync();
        }
    };
    const onVisibility = () => sync();
    const onAnimationEnd = (event) => {
        if (event.animationName === SCAN_ANIMATION) {
            event.target.classList.remove("is-scan");
        }
    };
    const onMotion = () => {
        if (reducedMotion.matches) {
            destroy();
        }
    };

    function destroy() {
        if (destroyed) {
            return;
        }
        destroyed = true;
        cancelAnimationFrame(raf);
        raf = 0;
        if (resizeObserver) {
            resizeObserver.disconnect();
        }
        if (intersectionObserver) {
            intersectionObserver.disconnect();
        }
        host.removeEventListener("pointerenter", onEnter);
        host.removeEventListener("pointerleave", onLeave);
        track.removeEventListener("animationend", onAnimationEnd);
        document.removeEventListener("visibilitychange", onVisibility);
        reducedMotion.removeEventListener("change", onMotion);
        for (let i = 0; i < clones.length; i++) {
            clones[i].remove();
        }
        clones.length = 0;
        for (let i = 0; i < originals.length; i++) {
            const card = originals[i];
            card.classList.remove("is-scan");
            const front = card.querySelector(".s_dz_features__ic-front");
            const code = card.querySelector(".s_dz_features__ic-code");
            if (front) {
                front.style.removeProperty("--clip-right");
            }
            if (code) {
                code.style.removeProperty("--clip-left");
                code.textContent = "";
            }
        }
        items = [];
        track.style.transform = "";
        host.classList.remove("is-live");
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    }

    host.classList.add("is-live");
    const resizeObserver = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    const intersectionObserver =
        typeof IntersectionObserver !== "undefined"
            ? new IntersectionObserver((entries) => {
                  inView = entries[entries.length - 1].isIntersecting;
                  sync();
              })
            : null;
    host.addEventListener("pointerenter", onEnter);
    host.addEventListener("pointerleave", onLeave);
    track.addEventListener("animationend", onAnimationEnd);
    document.addEventListener("visibilitychange", onVisibility);
    reducedMotion.addEventListener("change", onMotion);
    buildItems();
    measure();
    if (resizeObserver) {
        resizeObserver.observe(host);
    }
    if (intersectionObserver) {
        intersectionObserver.observe(host);
    }

    return { destroy };
}
// </core>

export class DzIndustryBeam extends Interaction {
    static selector = ".s_dz_features__beam";

    start() {
        this.beam = createCardBeam(this.el);
    }

    destroy() {
        if (this.beam) {
            this.beam.destroy();
            this.beam = null;
        }
    }
}

registry.category("public.interactions").add("theme_dataliza.dz_industry_beam", DzIndustryBeam);
