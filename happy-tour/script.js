(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var header = document.getElementById("header");
  var scrollBtn = document.getElementById("scroll-top");

  var FOCUSABLE =
    'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

  function prefersReducedMotion() {
    return motionQuery.matches;
  }

  function all(selector, context) {
    return Array.prototype.slice.call(
      (context || document).querySelectorAll(selector)
    );
  }

  /* matchMedia("change") with a fallback for older Safari */
  function onMediaChange(query, handler) {
    if (typeof query.addEventListener === "function") {
      query.addEventListener("change", handler);
    } else if (typeof query.addListener === "function") {
      query.addListener(handler);
    }
  }

  /* ------------------------------------------------------------
     Header scroll state + back-to-top visibility
     ------------------------------------------------------------ */
  var ticking = false;

  function onScroll() {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(function () {
      var y = window.scrollY || window.pageYOffset;
      if (header) header.classList.toggle("scrolled", y > 40);
      if (scrollBtn) scrollBtn.classList.toggle("show", y > 420);
      ticking = false;
    });
  }

  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  if (scrollBtn) {
    scrollBtn.addEventListener("click", function () {
      window.scrollTo({
        top: 0,
        behavior: prefersReducedMotion() ? "auto" : "smooth",
      });
      var logo = document.querySelector(".logo");
      if (logo) logo.focus({ preventScroll: true });
    });
  }

  /* ------------------------------------------------------------
     Reveal-on-scroll animations
     ------------------------------------------------------------ */
  var revealEls = all("[data-reveal]");

  revealEls.forEach(function (el) {
    var delay = parseInt(el.getAttribute("data-reveal-delay") || "0", 10);
    if (delay > 0) el.style.setProperty("--reveal-delay", delay + "ms");
  });

  function showAllReveals() {
    revealEls.forEach(function (el) {
      el.classList.add("is-visible");
    });
  }

  if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
    showAllReveals();
  } else {
    var revealObserver = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -45px 0px" }
    );
    revealEls.forEach(function (el) {
      revealObserver.observe(el);
    });
    /* If the user flips reduced-motion on mid-session, show everything */
    onMediaChange(motionQuery, function (e) {
      if (e.matches) showAllReveals();
    });
  }

  /* ------------------------------------------------------------
     Animated stat counters
     ------------------------------------------------------------ */
  var counters = all(".counter[data-count]");

  function animateCounter(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (prefersReducedMotion()) {
      el.textContent = target.toLocaleString("en-US");
      return;
    }
    var duration = 1600;
    var startTime = null;

    function step(timestamp) {
      if (!startTime) startTime = timestamp;
      var progress = Math.min((timestamp - startTime) / duration, 1);
      /* ease-out cubic */
      var eased = 1 - Math.pow(1 - progress, 3);
      el.textContent = Math.round(target * eased).toLocaleString("en-US");
      if (progress < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  if (counters.length) {
    if (prefersReducedMotion() || !("IntersectionObserver" in window)) {
      counters.forEach(animateCounter);
    } else {
      var counterObserver = new IntersectionObserver(
        function (entries, observer) {
          entries.forEach(function (entry) {
            if (entry.isIntersecting) {
              animateCounter(entry.target);
              observer.unobserve(entry.target);
            }
          });
        },
        { threshold: 0.5 }
      );
      counters.forEach(function (el) {
        /* start from zero so the animation has a visible start */
        el.textContent = "0";
        counterObserver.observe(el);
      });
    }
  }

  /* ------------------------------------------------------------
     Scroll-spy: highlight the nav link of the section in view
     ------------------------------------------------------------ */
  var navLinks = all(".navlink, .mobile-link");
  var spyTargets = all("main section[id], footer[id]");

  if (navLinks.length && spyTargets.length && "IntersectionObserver" in window) {
    var linksById = {};
    navLinks.forEach(function (link) {
      var id = (link.getAttribute("href") || "").replace("#", "");
      if (!id) return;
      if (!linksById[id]) linksById[id] = [];
      linksById[id].push(link);
    });

    var spyObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (link) {
            link.classList.remove("active");
          });
          var matches = linksById[entry.target.id] || [];
          matches.forEach(function (link) {
            link.classList.add("active");
          });
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );

    spyTargets.forEach(function (section) {
      spyObserver.observe(section);
    });
  }

  /* ------------------------------------------------------------
     Mobile navigation drawer
     Slide-in panel, backdrop, scroll lock, focus trap and Escape —
     all plain DOM, no framework component.
     ------------------------------------------------------------ */
  all(".drawer").forEach(function (panel) {
    var backdrop = document.querySelector(
      '[data-drawer-backdrop="' + panel.id + '"]'
    );
    var openers = all('[data-drawer-open="' + panel.id + '"]');
    var lastFocused = null;

    function isOpen() {
      return panel.classList.contains("is-open");
    }

    function focusables() {
      return all(FOCUSABLE, panel).filter(function (el) {
        return Boolean(el.offsetWidth || el.offsetHeight || el.getClientRects().length);
      });
    }

    function lockPage() {
      /* keep the layout from jumping when the scrollbar disappears */
      var gap = window.innerWidth - document.documentElement.clientWidth;
      if (gap > 0) {
        document.body.style.setProperty("--scrollbar-gap", gap + "px");
      }
      document.body.classList.add("is-locked");
    }

    function unlockPage() {
      document.body.classList.remove("is-locked");
      document.body.style.removeProperty("--scrollbar-gap");
    }

    function open() {
      if (isOpen()) return;
      lastFocused = document.activeElement;
      panel.classList.add("is-open");
      panel.setAttribute("aria-hidden", "false");
      if (backdrop) backdrop.classList.add("is-open");
      openers.forEach(function (button) {
        button.setAttribute("aria-expanded", "true");
      });
      lockPage();
      window.requestAnimationFrame(function () {
        var first = focusables()[0] || panel;
        first.focus({ preventScroll: true });
      });
    }

    function close() {
      if (!isOpen()) return;
      panel.classList.remove("is-open");
      panel.setAttribute("aria-hidden", "true");
      if (backdrop) backdrop.classList.remove("is-open");
      openers.forEach(function (button) {
        button.setAttribute("aria-expanded", "false");
      });
      unlockPage();
      if (lastFocused && typeof lastFocused.focus === "function") {
        lastFocused.focus({ preventScroll: true });
      }
      lastFocused = null;
    }

    openers.forEach(function (button) {
      button.addEventListener("click", open);
    });

    all("[data-drawer-close]", panel).forEach(function (button) {
      button.addEventListener("click", close);
    });

    if (backdrop) backdrop.addEventListener("click", close);

    /* Navigating to a section closes the panel again */
    all("a[href]", panel).forEach(function (link) {
      link.addEventListener("click", close);
    });

    panel.addEventListener("keydown", function (event) {
      if (event.key === "Escape" || event.key === "Esc") {
        close();
        return;
      }
      if (event.key !== "Tab") return;

      /* Keep Tab inside the drawer while it is open */
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    /* From 992px up the inline menu takes over, so drop the panel */
    onMediaChange(window.matchMedia("(min-width: 992px)"), function (event) {
      if (event.matches) close();
    });

    panel.setAttribute("aria-hidden", "true");
  });

  /* ------------------------------------------------------------
     Forms: friendly inline success messages (no alert() popups)
     ------------------------------------------------------------ */
  var today = new Date().toISOString().split("T")[0];
  ["checkin", "checkout"].forEach(function (id) {
    var input = document.getElementById(id);
    if (input) {
      input.setAttribute("min", today);
      input.addEventListener("change", function () {
        var checkout = document.getElementById("checkout");
        if (input.id === "checkin" && checkout) {
          checkout.setAttribute("min", input.value || today);
        }
      });
    }
  });

  all("form[data-form]").forEach(function (form) {
    form.addEventListener("submit", function (event) {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      var status = form.querySelector(".form-status");
      var kind = form.getAttribute("data-form");
      var message;

      if (kind === "booking") {
        var destination = form.querySelector("#destination");
        var tourType = form.querySelector("#tour-type");
        message =
          "Great choice! Your " +
          ((tourType && tourType.value ? tourType.value.toLowerCase() : "dream") +
            " trip") +
          (destination && destination.value
            ? " to " + destination.value
            : "") +
          " is being prepared. A travel expert will contact you shortly.";
      } else {
        message =
          "You're subscribed! Watch your inbox for exclusive deals and destination guides.";
      }

      if (status) {
        status.textContent = message;
        status.classList.add("is-visible");
      }
      form.reset();
    });
  });

  /* ------------------------------------------------------------
     Hero video: pause off-screen & honour reduced-motion
     ------------------------------------------------------------ */
  var heroVideo = document.querySelector(".hero-video");
  if (heroVideo) {
    var syncVideoWithMotion = function () {
      if (prefersReducedMotion()) {
        heroVideo.pause();
      } else {
        var playPromise = heroVideo.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(function () {
            /* Autoplay blocked — the poster image remains visible. */
          });
        }
      }
    };

    syncVideoWithMotion();
    onMediaChange(motionQuery, syncVideoWithMotion);

    if ("IntersectionObserver" in window) {
      new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (prefersReducedMotion()) return;
            if (entry.isIntersecting) {
              syncVideoWithMotion();
            } else {
              heroVideo.pause();
            }
          });
        },
        { threshold: 0.05 }
      ).observe(heroVideo);
    }
  }

  /* ------------------------------------------------------------
     Testimonials carousel
     Hand-written slider: looping track,
     autoplay, pointer drag, bullets, keyboard control and ARIA.
     Slides are stretched by CSS (align-items: stretch), so every
     card in a row is exactly as tall as the tallest one.
     ------------------------------------------------------------ */
  function initCarousel(root) {
    var viewport = root.querySelector(".carousel-viewport");
    var track = root.querySelector("[data-carousel-track]");
    var pagination = root.querySelector("[data-carousel-pagination]");
    if (!viewport || !track) return;

    var loop = root.hasAttribute("data-carousel-loop");
    var autoplayDelay = parseInt(
      root.getAttribute("data-carousel-autoplay") || "0",
      10
    );
    var originals = all(".carousel-slide", track);
    var count = originals.length;
    if (!count) return;

    var slides = [];
    var bullets = [];
    var perView = 1;
    var gap = 0;
    var slideWidth = 0;
    var index = 0;
    var timer = null;
    var paused = false;
    var dragging = false;
    var dragAxis = null;
    var dragMoved = false;
    var dragStartX = 0;
    var dragStartY = 0;
    var dragDelta = 0;
    var dragTime = 0;
    var resizeFrame = null;

    /* Same responsive steps the design has always used */
    function breakpoint() {
      var width = window.innerWidth;
      if (width >= 1200) return { perView: 3, gap: 28 };
      if (width >= 768) return { perView: 2, gap: 24 };
      return { perView: 1, gap: 28 };
    }

    function canLoop() {
      return loop && count > perView;
    }

    function maxIndex() {
      return slides.length - perView;
    }

    function offset(i) {
      return i * (slideWidth + gap);
    }

    function activeSlide() {
      var real = canLoop() ? index - perView : index;
      return ((real % count) + count) % count;
    }

    function makeClone(slide) {
      var copy = slide.cloneNode(true);
      copy.classList.add("carousel-slide--clone");
      copy.removeAttribute("role");
      copy.removeAttribute("aria-roledescription");
      copy.removeAttribute("aria-label");
      copy.setAttribute("aria-hidden", "true");
      all(FOCUSABLE, copy).forEach(function (el) {
        el.setAttribute("tabindex", "-1");
      });
      return copy;
    }

    /* Layout the track: [tail clones] [real slides] [lead clones] */
    function build() {
      var bp = breakpoint();
      perView = Math.min(bp.perView, count);
      gap = bp.gap;

      track.textContent = "";
      slides = [];
      var fragment = document.createDocumentFragment();
      var i;

      if (canLoop()) {
        for (i = count - perView; i < count; i++) {
          var lead = makeClone(originals[i]);
          fragment.appendChild(lead);
          slides.push(lead);
        }
      }
      originals.forEach(function (slide) {
        fragment.appendChild(slide);
        slides.push(slide);
      });
      if (canLoop()) {
        for (i = 0; i < perView; i++) {
          var tail = makeClone(originals[i]);
          fragment.appendChild(tail);
          slides.push(tail);
        }
      }
      track.appendChild(fragment);
      measure();
    }

    function measure() {
      var width = viewport.clientWidth;
      if (!width) return; /* hidden: keep the CSS fallback widths */
      slideWidth = (width - gap * (perView - 1)) / perView;
      track.style.setProperty("--carousel-gap", gap + "px");
      track.style.setProperty("--carousel-slide-width", slideWidth + "px");
    }

    function sync() {
      var active = activeSlide();
      bullets.forEach(function (bullet, i) {
        bullet.classList.toggle("is-active", i === active);
        if (i === active) bullet.setAttribute("aria-current", "true");
        else bullet.removeAttribute("aria-current");
      });
      /* A rotating carousel should not spam screen readers */
      viewport.setAttribute("aria-live", timer ? "off" : "polite");
    }

    function render(animate) {
      var move = Boolean(animate) && !prefersReducedMotion();
      track.classList.toggle("is-animating", move);
      track.style.transform = "translate3d(" + -offset(index) + "px, 0, 0)";
      return move;
    }

    /* Jump without animating — used to close the loop seamlessly */
    function jump(i) {
      index = i;
      track.classList.remove("is-animating");
      track.style.transform = "translate3d(" + -offset(index) + "px, 0, 0)";
      void track.offsetWidth; /* reflow, so the next move starts from here */
    }

    function settle() {
      if (!canLoop()) return;
      if (index >= count + perView) jump(index - count);
      else if (index < perView) jump(index + count);
    }

    function goTo(i, animate) {
      if (!canLoop()) i = Math.max(0, Math.min(i, maxIndex()));
      index = i;
      if (!render(animate)) settle();
      sync();
    }

    function next() {
      goTo(index + 1, true);
    }

    function previous() {
      goTo(index - 1, true);
    }

    function goToSlide(n) {
      /* Looping can show the last slides next to their clones, so every
         bullet is reachable; without a loop the last full view is the end. */
      var last = canLoop() ? count - 1 : count - perView;
      goTo((canLoop() ? perView : 0) + Math.max(0, Math.min(n, last)), true);
    }

    function buildPagination() {
      if (!pagination) return;
      pagination.textContent = "";
      bullets = [];
      for (var i = 0; i < count; i++) {
        var bullet = document.createElement("button");
        bullet.type = "button";
        bullet.className = "carousel-bullet";
        bullet.setAttribute(
          "aria-label",
          "Show testimonial " + (i + 1) + " of " + count
        );
        (function (n, el) {
          el.addEventListener("click", function () {
            goToSlide(n);
          });
        })(i, bullet);
        pagination.appendChild(bullet);
        bullets.push(bullet);
      }
    }

    /* --- autoplay --------------------------------------------------- */
    function startAutoplay() {
      stopAutoplay();
      if (!autoplayDelay || paused || prefersReducedMotion() || document.hidden) {
        sync();
        return;
      }
      timer = window.setTimeout(function () {
        timer = null;
        next();
        startAutoplay();
      }, autoplayDelay);
      sync();
    }

    function stopAutoplay() {
      if (timer) {
        window.clearTimeout(timer);
        timer = null;
      }
      sync();
    }

    root.addEventListener("mouseenter", function () {
      paused = true;
      stopAutoplay();
    });

    root.addEventListener("mouseleave", function () {
      paused = false;
      startAutoplay();
    });

    root.addEventListener("focusin", function () {
      paused = true;
      stopAutoplay();
    });

    root.addEventListener("focusout", function (event) {
      if (root.contains(event.relatedTarget)) return;
      paused = false;
      startAutoplay();
    });

    document.addEventListener("visibilitychange", function () {
      if (document.hidden) stopAutoplay();
      else if (!paused) startAutoplay();
    });

    /* --- pointer drag / swipe --------------------------------------- */
    function endDrag() {
      dragging = false;
      dragAxis = null;
      viewport.classList.remove("is-dragging");
      if (!paused) startAutoplay();
    }

    viewport.addEventListener("pointerdown", function (event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      if (event.target.closest("a, button")) return; /* leave clicks alone */
      dragging = true;
      dragMoved = false;
      dragAxis = null;
      dragDelta = 0;
      dragStartX = event.clientX;
      dragStartY = event.clientY;
      dragTime = Date.now();
      track.classList.remove("is-animating");
      stopAutoplay();
      if (viewport.setPointerCapture) {
        try {
          viewport.setPointerCapture(event.pointerId);
        } catch (err) {
          /* capture is a nicety, not a requirement */
        }
      }
    });

    viewport.addEventListener("pointermove", function (event) {
      if (!dragging) return;
      var dx = event.clientX - dragStartX;
      var dy = event.clientY - dragStartY;

      if (!dragAxis) {
        if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;
        dragAxis = Math.abs(dx) > Math.abs(dy) ? "x" : "y";
        if (dragAxis === "y") {
          endDrag(); /* vertical gesture: let the page scroll */
          return;
        }
        viewport.classList.add("is-dragging");
      }

      if (event.cancelable) event.preventDefault();
      dragMoved = true;
      dragDelta = dx;

      var px = offset(index) - dragDelta;
      if (!canLoop()) {
        /* rubber-band at both ends instead of showing empty track */
        var max = offset(maxIndex());
        if (px < 0) px *= 0.35;
        else if (px > max) px = max + (px - max) * 0.35;
      }
      track.style.transform = "translate3d(" + -px + "px, 0, 0)";
    });

    viewport.addEventListener("pointerup", release);
    viewport.addEventListener("pointercancel", release);

    function release() {
      if (!dragging) return;
      var elapsed = Math.max(Date.now() - dragTime, 1);
      var velocity = Math.abs(dragDelta) / elapsed; /* px per ms */
      var flick = Math.abs(dragDelta) > 12 && velocity > 0.45;
      var pastHalf = Math.abs(dragDelta) > slideWidth * 0.25;
      var direction = dragDelta < 0 ? 1 : -1;
      endDrag();
      if (flick || pastHalf) {
        goTo(index + direction, true);
      } else {
        goTo(index, true); /* snap back */
      }
      dragDelta = 0;
    }

    /* A drag must not turn into a click on whatever was under the cursor */
    viewport.addEventListener(
      "click",
      function (event) {
        if (!dragMoved) return;
        event.preventDefault();
        event.stopPropagation();
        dragMoved = false;
      },
      true
    );

    track.addEventListener("transitionend", function (event) {
      if (event.target !== track || event.propertyName !== "transform") return;
      settle();
    });

    /* --- keyboard ---------------------------------------------------- */
    root.addEventListener("keydown", function (event) {
      var step = null;
      if (event.key === "ArrowLeft") step = -1;
      else if (event.key === "ArrowRight") step = 1;
      else if (event.key === "Home") step = "first";
      else if (event.key === "End") step = "last";
      if (step === null) return;

      event.preventDefault();
      if (step === "first") goToSlide(0);
      else if (step === "last") goToSlide(count - 1);
      else goTo(index + step, true);

      /* Keep focus on the bullet of the slide now in view */
      var onBullet =
        document.activeElement &&
        document.activeElement.classList.contains("carousel-bullet");
      if (onBullet && bullets[activeSlide()]) bullets[activeSlide()].focus();
    });

    /* --- resize ------------------------------------------------------ */
    window.addEventListener("resize", function () {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(function () {
        resizeFrame = null;
        var real = activeSlide();
        var bp = breakpoint();
        if (bp.perView !== perView || bp.gap !== gap) {
          build();
          index =
            (canLoop() ? perView : 0) + Math.min(real, count - perView);
        }
        measure();
        goTo(index, false);
      });
    });

    /* --- go ---------------------------------------------------------- */
    buildPagination();
    build();
    index = canLoop() ? perView : 0;
    goTo(index, false);
    startAutoplay();

    onMediaChange(motionQuery, function () {
      if (prefersReducedMotion()) stopAutoplay();
      else if (!paused) startAutoplay();
    });
  }

  all("[data-carousel]").forEach(initCarousel);

  /* ------------------------------------------------------------
     Footer year
     ------------------------------------------------------------ */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
