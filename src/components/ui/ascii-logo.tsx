const LOGO = `                       ++++++++++++++++++++++++++++++++++++++++++++++++
                      ++++++++++++++++++++++++++++++++++++++++++++++++++
                     ++++                                            ++++
                   *++++                                              ++++*
                  *++++                        -                       ++++*
                 *++++                       =++==                      ++++*
                *++++                      =++++++=                      ++++*
               *++++                     =++++++++++=                     ++++*
              +++++                   -=+++++=  -+++++=-                   +++++
             ++++*                 -+++++++=      -+++++++-                 *++++
            ++++*            =-=++++++++++          -=+++++++++-==           *++++
           ++++*   -++++++++++++++++++=-   -----::-:   =++++++++++++++++++=   *++++
          ++++*    =+++++++++++++==-  -=++++++++::++++- - =-+++++++++++++++    *++++
         ++++*     +++++           -=+=- :+++-----+++-:=++=           =++++-    *++++
        ++++                     -=++= -+++==-----==+=- -=++=                     ++++
       ++++                     =+++++=::   --==--:  :-+=+++++-                    ++++
      ++++                    -++++++=  -=+=-:  -++-:   -+++=-==                    ++++
     ++++                    :+=++=   -+-      -=- ===-   - :: ==                    ++++
   *++++           -+++=     ==-     ==        =- =++++=   -++--+-     ++++           ++++*
  *++++            -++++    -+++++: +=         == -++++- =- =+++++:   =+++=            ++++*
 *++++              =+++-   ----+= -=:      =++++=-    -++= -+++++-   =+++=             ++++*
*++++               -++++    ===+- ==      -+++++++=++== -+ :=- ++-  :++++               ++++*
*++++                        =+++- ==      -++++++=      -= -=- ---                      *+++*
 *++++                      =++++= -+-      -=+++=       == -+====-                     ++++*
  *++++                     :+++++- -+:                 == :=+++++                     ++++*
   *++++               =+++= ==:  =- -+-              :==  ==  -=- ++++-              ++++*
     ++++               ++++- -++- =-  =+-          -=+: :+= :+=: =+++-              ++++
      ++++               ++++= =++++++-  -=++====++=-  :=++++++- ++++-              ++++
       ++++              -++++- -+++++= --             -+++++=- ++++=              ++++
        ++++                      =++= -=+++++==++++= -++++=-                     ++++
         ++++*                      -===:-++-    =+++=-=+=-                     *++++
          ++++*                        -==++= =++++++=-:                       *++++
           ++++*                               :                              *++++
            ++++*              =++++=                    =++++=              *++++
             ++++*               +++++=                -+++++-              *++++
              +++++               -++++++:          :++++++=               +++++
               *++++                -++++++++++++++++++++=                ++++*
                *++++                 -=++++++++++++++=-                 ++++*
                 *++++                    ==++++++==-                   ++++*
                  *++++                                                ++++*
                   *++++                                              ++++*
                     ++++                                            ++++
                      ++++++++++++++++++++++++++++++++++++++++++++++++++
                       ++++++++++++++++++++++++++++++++++++++++++++++++`;

// JetBrains Mono's glyph advance width is ~0.6em; this art is 44 rows by up
// to 94 columns, so a line-height of (94/44)*0.6em ≈ 1.28em is needed for the
// rendered grid to be roughly as wide as it is tall (otherwise the emblem
// reads as squashed/stretched instead of the circular badge it's drawn as).
const FACE_CLASSES =
  "[backface-visibility:hidden] whitespace-pre select-none text-center font-[family-name:var(--font-jetbrains)] text-[0.3rem] leading-[1.28] text-signal-cyan sm:text-[0.4rem]";

// The Galvanism emblem (info/card_design/ascii.txt), rendered as a
// double-sided spinning card so the back face reads right-side-up instead of
// mirrored at the CSS backface.
export function AsciiLogo() {
  return (
    <div
      role="img"
      aria-label="Galvanism regiment emblem"
      className="flex justify-center py-6"
      style={{ perspective: "3200px" }}
    >
      <div
        className="relative [transform-style:preserve-3d]"
        style={{ animation: "ascii-spin 8s linear infinite" }}
      >

        <pre className={FACE_CLASSES}>{LOGO}</pre>
        <pre className={`${FACE_CLASSES} absolute inset-0 [transform:rotateY(180deg)]`}>
          {LOGO}
        </pre>
      </div>
    </div>
  );
}
