
(function () {
  "use strict";

  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var header = document.getElementById("header");
  var scrollBtn = document.getElementById("scroll-top");

  function prefersReducedMotion() {
    return motionQuery.matches;
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
  var revealEls = Array.prototype.slice.call(
    document.querySelectorAll("[data-reveal]")
  );

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
    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", function (e) {
        if (e.matches) showAllReveals();
      });
    }
  }

  /* ------------------------------------------------------------
     Animated stat counters
     ------------------------------------------------------------ */
  var counters = Array.prototype.slice.call(
    document.querySelectorAll(".counter[data-count]")
  );

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
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll(".navlink, .mobile-link")
  );
  var spyTargets = Array.prototype.slice.call(
    document.querySelectorAll("main section[id], footer[id]")
  );

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
     Mobile offcanvas: close after navigating, keep focus tidy
     ------------------------------------------------------------ */
  var mobileMenu = document.getElementById("mobile-menu");
  if (mobileMenu && window.bootstrap) {
    mobileMenu
      .querySelectorAll("a[href^='#']")
      .forEach(function (link) {
        link.addEventListener("click", function () {
          var instance = window.bootstrap.Offcanvas.getInstance(mobileMenu);
          if (instance) instance.hide();
        });
      });
  }

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

  document.querySelectorAll("form[data-form]").forEach(function (form) {
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

    if (typeof motionQuery.addEventListener === "function") {
      motionQuery.addEventListener("change", syncVideoWithMotion);
    }

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
     Testimonials carousel (Swiper)
     ------------------------------------------------------------ */
  var swiperEl = document.querySelector(".testimonial-swiper");
  if (swiperEl && typeof window.Swiper === "function") {
    new window.Swiper(swiperEl, {
      loop: true,
      speed: 700,
      spaceBetween: 28,
      slidesPerView: 1,
      grabCursor: true,
      watchOverflow: true,
      autoplay: prefersReducedMotion()
        ? false
        : {
            delay: 5500,
            disableOnInteraction: false,
            pauseOnMouseEnter: true,
          },
      pagination: {
        el: ".swiper-pagination",
        clickable: true,
      },
      a11y: {
        enabled: true,
      },
      breakpoints: {
        768: {
          slidesPerView: 2,
          spaceBetween: 24,
        },
        1200: {
          slidesPerView: 3,
          spaceBetween: 28,
        },
      },
    });
  }

  /* ------------------------------------------------------------
     Footer year
     ------------------------------------------------------------ */
  var yearEl = document.getElementById("year");
  if (yearEl) {
    yearEl.textContent = String(new Date().getFullYear());
  }
})();
