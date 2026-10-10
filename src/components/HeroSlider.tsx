"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import useSWR from "swr";

export interface Slide {
  src: string;
  title?: string;
  text?: string;
}


const MAX_SLIDES = 4;
const DEFAULT_INTERVAL = 6000;

const fetcher = async (url: string): Promise<Slide[]> => {
  try {
    const response = await fetch(url, {
      cache: "no-store",
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();

    if (!Array.isArray(data.slides)) {
      return [];
    }

    return data.slides
      .filter(
        (slide: Slide) =>
          slide &&
          typeof slide.src === "string" &&
          slide.src.trim() !== ""
      )
      .slice(0, MAX_SLIDES);
  } catch (error) {
    console.error("Failed to load slides:", error);
    return [];
  }
};

/* =========================================================
   useSlides
========================================================= */

export function useSlides() {
  const { data, isLoading, error } = useSWR<Slide[]>(
    "/slides",
    fetcher,
    {
      revalidateOnFocus: false,
      revalidateOnReconnect: false,
      refreshInterval: 0,
    }
  );

  return {
    slides: (data ?? []).slice(0, MAX_SLIDES),
    isLoading,
    error,
  };
}

/* =========================================================
   Reduced Motion
========================================================= */

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    );

    setReduced(mediaQuery.matches);

    const handleChange = (
      event: MediaQueryListEvent
    ) => {
      setReduced(event.matches);
    };

    mediaQuery.addEventListener(
      "change",
      handleChange
    );

    return () => {
      mediaQuery.removeEventListener(
        "change",
        handleChange
      );
    };
  }, []);

  return reduced;
}

/* =========================================================
   Hero Slider
========================================================= */

export function HeroSlider({
  className = "",
  interval = DEFAULT_INTERVAL,
  children,
  fallback = null,
  showCaption = true,
  ariaLabel = "ຮູບພາບລະບົບຈັດການຫໍພັກ",
}: {
  className?: string;
  interval?: number;
  children?: React.ReactNode;
  fallback?: React.ReactNode;
  showCaption?: boolean;
  ariaLabel?: string;
}) {
  const { slides, isLoading } = useSlides();

  const reduced = usePrefersReducedMotion();

  const [index, setIndex] = useState(0);

  const touchX = useRef<number | null>(null);

  const count = slides.length;
  const multi = count > 1;

  /* =======================================================
     Go To Slide
  ======================================================= */

  const goToSlide = useCallback(
    (newIndex: number) => {
      if (!count) return;

      const nextIndex =
        ((newIndex % count) + count) % count;

      setIndex(nextIndex);
    },
    [count]
  );

  /* =======================================================
     Reset Index
  ======================================================= */

  useEffect(() => {
    if (!count) {
      setIndex(0);
      return;
    }

    if (index >= count) {
      setIndex(0);
    }
  }, [count, index]);

  /* =======================================================
     Auto Slide
  ======================================================= */

  useEffect(() => {
    if (!multi || reduced) {
      return;
    }

    const timer = window.setInterval(() => {
      setIndex((current) =>
        current + 1 >= count
          ? 0
          : current + 1
      );
    }, interval);

    return () => {
      window.clearInterval(timer);
    };
  }, [
    count,
    interval,
    multi,
    reduced,
  ]);

  /* =======================================================
     Loading
  ======================================================= */

  if (isLoading) {
    return (
      <div
        className={`
          relative
          min-h-[420px]
          overflow-hidden
          rounded-3xl
          border
          border-blue-100
          bg-gradient-to-br
          from-blue-50
          via-white
          to-cyan-50
          shadow-xl
          animate-pulse
          ${className}
        `}
        aria-label="ກຳລັງໂຫຼດຮູບ..."
      >
        <div
          className="
            absolute
            inset-0
            bg-gradient-to-br
            from-blue-100/60
            via-white
            to-cyan-100/60
          "
        />

        <div
          className="
            absolute
            left-8
            top-8
            h-10
            w-32
            rounded-full
            bg-blue-200/60
          "
        />

        <div
          className="
            absolute
            bottom-12
            left-8
            h-12
            w-72
            rounded-xl
            bg-blue-200/60
          "
        />
      </div>
    );
  }

  /* =======================================================
     No Slides
  ======================================================= */

  if (!count) {
    return <>{fallback}</>;
  }

  const current = slides[index];

  /* =======================================================
     Render
  ======================================================= */

  return (
    <section
      className={`
        group
        relative
        isolate
        min-h-[420px]
        overflow-hidden
        rounded-3xl
        border
        border-blue-100
        bg-white
        shadow-xl
        shadow-blue-100/60
        ${className}
      `}
      aria-roledescription="carousel"
      aria-label={ariaLabel}
      tabIndex={0}
      onTouchStart={(event) => {
        touchX.current =
          event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchX.current === null) {
          return;
        }

        const endX =
          event.changedTouches[0]?.clientX ?? 0;

        const distance =
          endX - touchX.current;

        touchX.current = null;

        if (Math.abs(distance) > 45) {
          if (distance < 0) {
            goToSlide(index + 1);
          } else {
            goToSlide(index - 1);
          }
        }
      }}
    >
      {/* =================================================
          Images
      ================================================= */}

      <div className="absolute inset-0">
        {slides.map((slide, slideIndex) => {
          const active =
            slideIndex === index;

          return (
            <div
              key={slide.src}
              role="group"
              aria-roledescription="slide"
              aria-label={`ຮູບທີ ${
                slideIndex + 1
              } ຈາກ ${count}`}
              aria-hidden={!active}
              className={`
                absolute
                inset-0
                transition-opacity
                duration-[1200ms]
                ease-in-out
                ${
                  active
                    ? "opacity-100"
                    : "opacity-0"
                }
              `}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={slide.src}
                alt={
                  slide.title ||
                  `ຮູບພາບຫໍພັກ ${
                    slideIndex + 1
                  }`
                }
                loading={
                  slideIndex === 0
                    ? "eager"
                    : "lazy"
                }
                draggable={false}
                className={`
                  h-full
                  w-full
                  select-none
                  object-cover
                  transition-transform
                  duration-[7000ms]
                  ease-out
                  ${
                    active && !reduced
                      ? "scale-105"
                      : "scale-100"
                  }
                `}
              />
            </div>
          );
        })}
      </div>

      {/* =================================================
          Bright Color Overlay
      ================================================= */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-0
          bg-gradient-to-r
          from-blue-950/45
          via-blue-900/10
          to-transparent
        "
      />

      {/* Bottom soft gradient */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          inset-x-0
          bottom-0
          h-2/3
          bg-gradient-to-t
          from-blue-950/55
          via-blue-900/15
          to-transparent
        "
      />

      {/* =================================================
          Color Glow
      ================================================= */}

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -right-24
          -top-24
          size-72
          rounded-full
          bg-cyan-400/20
          blur-3xl
        "
      />

      <div
        aria-hidden="true"
        className="
          pointer-events-none
          absolute
          -bottom-24
          -left-24
          size-72
          rounded-full
          bg-blue-500/20
          blur-3xl
        "
      />

      {/* =================================================
          Top Badge
      ================================================= */}

      <div
        className="
          absolute
          left-5
          top-5
          sm:left-8
          sm:top-8
        "
      >
        <div
          className="
            inline-flex
            items-center
            gap-2
            rounded-full
            border
            border-white/40
            bg-blue-600/75
            px-4
            py-2
            text-xs
            font-bold
            tracking-[0.18em]
            text-white
            shadow-lg
            shadow-blue-900/20
            backdrop-blur-md
          "
        >
          <span
            className="
              size-2
              rounded-full
              bg-cyan-300
              shadow-[0_0_12px_rgba(103,232,249,0.9)]
            "
          />

          DORMITORY
        </div>
      </div>

      {/* =================================================
          Counter
      ================================================= */}

      {multi && (
        <div
          className="
            absolute
            right-5
            top-5
            sm:right-8
            sm:top-8
          "
        >
          <div
            className="
              rounded-full
              border
              border-white/50
              bg-white/85
              px-4
              py-2
              font-mono
              text-sm
              font-bold
              text-blue-700
              shadow-lg
              shadow-blue-900/10
              backdrop-blur-md
            "
          >
            <span>
              {String(index + 1).padStart(2, "0")}
            </span>

            <span className="mx-1 text-blue-300">
              /
            </span>

            <span className="text-blue-400">
              {String(count).padStart(2, "0")}
            </span>
          </div>
        </div>
      )}

      {/* =================================================
          Content
      ================================================= */}

      <div
        className="
          relative
          flex
          min-h-[420px]
          flex-col
          justify-end
          p-5
          sm:p-8
          lg:p-10
        "
      >
        {children}

        {/* =================================================
            Caption Card
        ================================================= */}

        {showCaption &&
          (current.title || current.text) && (
            <div
              key={current.src}
              className="
                animate-in
                slide-in-from-bottom-4
                fade-in
                duration-700
                max-w-2xl
              "
              aria-live="polite"
            >
              <div
                className="
                  rounded-2xl
                  border
                  border-white/40
                  bg-white/88
                  p-5
                  shadow-2xl
                  shadow-blue-950/20
                  backdrop-blur-xl
                  sm:p-6
                "
              >
                {/* Label */}

                <div className="mb-3 flex items-center gap-3">
                  <span
                    className="
                      h-1
                      w-10
                      rounded-full
                      bg-gradient-to-r
                      from-blue-600
                      to-cyan-400
                    "
                  />

                  <span
                    className="
                      text-xs
                      font-extrabold
                      uppercase
                      tracking-[0.22em]
                      text-blue-600
                    "
                  >
                    Welcome
                  </span>
                </div>

                {/* Title */}

                {current.title && (
                  <h2
                    className="
                      max-w-2xl
                      text-2xl
                      font-extrabold
                      leading-tight
                      tracking-tight
                      text-slate-900
                      sm:text-3xl
                      lg:text-4xl
                    "
                  >
                    {current.title}
                  </h2>
                )}

                {/* Text */}

                {current.text && (
                  <p
                    className="
                      mt-3
                      max-w-xl
                      text-sm
                      font-medium
                      leading-6
                      text-slate-600
                      sm:text-base
                    "
                  >
                    {current.text}
                  </p>
                )}
              </div>
            </div>
          )}

        {/* =================================================
            Progress
        ================================================= */}

        {multi && (
          <div className="mt-5 flex max-w-md gap-2">
            {slides.map(
              (slide, slideIndex) => {
                const active =
                  slideIndex === index;

                const completed =
                  slideIndex < index;

                return (
                  <button
                    key={slide.src}
                    type="button"
                    onClick={() =>
                      goToSlide(slideIndex)
                    }
                    aria-label={`ໄປຮູບທີ ${
                      slideIndex + 1
                    }`}
                    aria-current={
                      active
                        ? "true"
                        : undefined
                    }
                    className="
                      group/progress
                      relative
                      h-5
                      flex-1
                      cursor-pointer
                      rounded-full
                      focus-visible:outline-none
                      focus-visible:ring-2
                      focus-visible:ring-cyan-400
                      focus-visible:ring-offset-2
                    "
                  >
                    <span
                      className={`
                        absolute
                        left-0
                        right-0
                        top-1/2
                        h-[5px]
                        -translate-y-1/2
                        overflow-hidden
                        rounded-full
                        border
                        border-white/30
                        transition-all
                        ${
                          active
                            ? "bg-blue-200/80"
                            : "bg-white/60"
                        }
                      `}
                    >
                      {completed && (
                        <span
                          className="
                            absolute
                            inset-0
                            bg-gradient-to-r
                            from-blue-600
                            to-cyan-400
                          "
                        />
                      )}

                      {active && (
                        <span
                          key={`${index}-${interval}`}
                          className="
                            absolute
                            inset-y-0
                            left-0
                            rounded-full
                            bg-gradient-to-r
                            from-blue-600
                            to-cyan-400
                          "
                          style={{
                            width: reduced
                              ? "100%"
                              : undefined,
                            animation: reduced
                              ? "none"
                              : `slideProgress ${interval}ms linear forwards`,
                          }}
                        />
                      )}
                    </span>
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </section>
  );
}
