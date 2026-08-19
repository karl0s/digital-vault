"""Subject-focus scoring.

Two requirements drive this:
  1. no crowd shots
  2. the SUBJECT must be in focus - background sharpness is irrelevant, and the
     subject may be a face, a body, or hands on a drum kit or guitar.

Global variance-of-Laplacian fails both. A crowd of 50,000 faces is the busiest
texture in any frame, so it wins on sharpness; and a frame whose background is
razor sharp scores well even when the performer is smeared.

Instead the frame is tiled and the DISTRIBUTION of local sharpness is examined:

  crowd        - uniformly sharp everywhere      -> high 'spread'
  subject shot - one sharp region, softer around -> low 'spread', high 'peak'

'peak' is measured on the central region, because concert footage frames its
subject centrally and the edges are usually lighting rigs, screens and audience.
"""
from __future__ import annotations
import numpy as np
from PIL import Image

TY, TX = 6, 8


def tile_sharpness(gray: np.ndarray):
    lap = (gray[:-2,1:-1] + gray[2:,1:-1] + gray[1:-1,:-2] + gray[1:-1,2:]
           - 4*gray[1:-1,1:-1])
    h, w = lap.shape
    ts = np.zeros((TY, TX), dtype=np.float32)
    for y in range(TY):
        y0, y1 = y*h//TY, (y+1)*h//TY
        for x in range(TX):
            x0, x1 = x*w//TX, (x+1)*w//TX
            ts[y, x] = lap[y0:y1, x0:x1].var()
    return ts


def analyse(path):
    with Image.open(path) as im:
        W, H = im.size
        g = np.asarray(im.convert("L").resize((480, max(1, int(480*H/W)))), dtype=np.float32)
        rgb = np.asarray(im.convert("RGB").resize((64, 48)), dtype=np.float32)
        rgb_full = np.asarray(im.convert("RGB").resize((160, 120)), dtype=np.uint8)

    ts = tile_sharpness(g)
    peak_all = float(np.percentile(ts, 92)) + 1e-6

    # A crowd is uniformly busy: no calm regions anywhere. A subject shot always
    # has quiet areas - dark stage, sky, lighting rig. These four capture that.
    spread = float((ts > 0.45*peak_all).mean())
    quiet  = float((ts < 0.15*peak_all).mean())
    cv     = float(ts.std()/(ts.mean()+1e-6))
    lo_hi  = float(np.log10((ts.max()+1)/(ts.min()+1)))
    lap_full = (g[:-2,1:-1]+g[2:,1:-1]+g[1:-1,:-2]+g[1:-1,2:]-4*g[1:-1,1:-1])
    edge_density = float((np.abs(lap_full) > 12).mean())

    # subject focus: sharpness of the best CENTRAL region
    centre = ts[1:TY-1, 1:TX-1]
    subject = float(centre.max()) if centre.size else peak_all
    # concentration: one dominant region vs uniformly busy
    conc = float(subject / (float(np.median(ts)) + 1e-6))

    mean = float(g.mean()); contrast = float(g.std())
    R, G, B = rgb[...,0], rgb[...,1], rgb[...,2]
    rg, yb = np.abs(R-G), np.abs(0.5*(R+G)-B)
    colour = float(np.sqrt(rg.std()**2 + yb.std()**2) + 0.3*np.sqrt(rg.mean()**2 + yb.mean()**2))
    exposure = 1.0 - min(1.0, abs(mean-118)/118)

    # --- graphics and night-crowd detection ---------------------------------
    # Title cards score superbly on subject sharpness: crisp text on a clean
    # background is exactly the signature a focus metric rewards. And night-time
    # crowds defeat the "crowds have no quiet regions" rule, because the dark
    # gaps between people read as calm areas.
    #
    # Two cheap signals separate both, measured on hand-labelled frames:
    #   graphics - almost entirely black (lit 0.05-0.09 vs 0.48 typical),
    #              large flat areas, tiny colour palette
    #   crowds   - huge colour palette from clothing (547-1220 distinct),
    #              and almost no flat regions
    # NOTE: fitted on a small sample (4 crowds, 2 graphics). It is a heuristic,
    # not a trained classifier, and is deliberately biased toward rejection.
    lit_frac = float((g > 26).mean())
    bs = 8; hh, ww = g.shape
    blocks = (g[:hh//bs*bs, :ww//bs*bs].reshape(hh//bs, bs, ww//bs, bs)
              .transpose(0,2,1,3).reshape(-1, bs*bs))
    flat = float((blocks.std(axis=1) < 3.0).mean())
    qc = (rgb_full >> 4).astype(np.int32)
    palette = int(len(np.unique(qc[...,0]*256 + qc[...,1]*16 + qc[...,2])))

    # Title cards come in both flavours: near-black (Rock in Rio "JOIN US")
    # and near-white (MTV "LET THERE BE MUSIC"). Both are extreme luminance,
    # mostly flat, tiny palette - so test both tails, not just the dark one.
    extreme_lum = lit_frac < 0.11 or lit_frac > 0.93
    is_graphic = extreme_lum and flat > 0.68 and palette < 400
    is_crowd2  = palette > 520 and flat < 0.50

    small = np.asarray(Image.open(path).convert("L").resize((9,8)), dtype=np.int16)
    dhash = int("".join("1" if b else "0" for b in (small[:,1:] > small[:,:-1]).flatten()), 2)

    # --- verdict -----------------------------------------------------------
    # Composite "subjectness". Weights and threshold were fitted against frames
    # hand-labelled from two contact sheets, not guessed: crowds score 0.21-0.60,
    # subject shots 0.36-0.92. A cut at 0.60 blocks 100% of crowds at the cost of
    # ~22% of subjects - the right trade because capture density was tripled to
    # compensate, and a missed good frame is cheap while a crowd shot is not.
    subjectness = (0.38*min(1.0, lo_hi/3.4) + 0.30*min(1.0, quiet/0.55)
                   + 0.20*min(1.0, cv/1.6) + 0.12*(1.0 - min(1.0, edge_density/0.6)))
    crowd = (subjectness < 0.60) or is_crowd2 or is_graphic

    score = 0.0
    if not crowd:
        score += 60 * min(1.0, subject/2500.0)   # SUBJECT sharpness dominates
        score += 15 * min(1.0, (subjectness-0.60)/0.32)
        score += 12 * exposure
        score +=  8 * min(1.0, conc/20.0)
        score +=  5 * min(1.0, contrast/70.0)
    return {"subject":subject, "spread":spread, "conc":conc, "crowd":bool(crowd),
            "graphic":bool(is_graphic), "crowd2":bool(is_crowd2),
            "lit":lit_frac, "flat":flat, "palette":palette,
            "subjectness":subjectness, "quiet":quiet, "cv":cv, "edge":edge_density,
            "mean":mean, "contrast":contrast, "colour":colour, "exposure":exposure,
            "score":score, "dhash":dhash, "sharp":subject}
