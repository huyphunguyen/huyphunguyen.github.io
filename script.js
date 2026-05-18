// === UTILITY FUNCTIONS ===
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);


// === COSMICWEB 3D — Survey Cones with Perspective Projection ===
// 12 survey cones on Fibonacci sphere, true 3D perspective divide,
// redshift color (blue→red), origin anchored to portrait/hero photo.
class CosmicWeb {
    constructor(canvasId) {
        this.canvas = $(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.cones = [];
        this.galaxies = [];
        this.precession = 0;
        this.OX = 0;
        this.OY = 0;
        this.portraitCenter = null;
        this.initialPortraitCenter = null;
        this.cfg = {
            coneCount:       12,
            galaxiesPerCone: 2200,
            maxDist3D:       1.8,
            coneHalfAngle:   0.18,
            focalLength:     1.6,
            precessionSpeed: 0.00008,
        };
        this.init();
    }

    init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initialize());
        } else {
            this.initialize();
        }
    }

    initialize() {
        this.resize();
        this.updateOrigin();
        this.initialPortraitCenter = { ...this.portraitCenter };
        this.generateCones();
        this.generateGalaxies();
        this.animate();

        window.addEventListener('resize', () => {
            this.resize();
            this.updateOrigin();
            this.initialPortraitCenter = { ...this.portraitCenter };
            this.generateCones();
            this.generateGalaxies();
        });

        window.addEventListener('scroll', () => { this.updateOrigin(); });

        // Re-measure after layout settles (fonts shift DOM)
        requestAnimationFrame(() => { this.updateOrigin(); });
    }

    resize() {
        this.canvas.width  = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }

    updateOrigin() {
        const portrait = document.querySelector('.about-image');
        const isPortraitPage = window.location.pathname.includes('about') ||
                               window.location.pathname === '/' ||
                               window.location.pathname.endsWith('index.html');

        if (portrait && isPortraitPage) {
            const r = portrait.getBoundingClientRect();
            this.OX = r.left + r.width  / 2;
            this.OY = r.top  + r.height / 2;
            this.portraitCenter = { x: this.OX, y: this.OY, isPortrait: true };
        } else {
            this.OX = Math.min(window.innerWidth * 0.75, window.innerWidth - 250);
            this.OY = Math.min(window.innerHeight * 0.4, 400);
            this.portraitCenter = { x: this.OX, y: this.OY, isPortrait: false };
        }
    }

    // Fibonacci sphere — uniform distribution of N points on unit sphere
    fibSphere(n) {
        const pts = [];
        const golden = Math.PI * (3 - Math.sqrt(5));
        for (let i = 0; i < n; i++) {
            const y  = 1 - (i / (n - 1)) * 2;
            const r  = Math.sqrt(1 - y * y);
            const th = golden * i;
            pts.push({ ax: r * Math.cos(th), ay: y, az: r * Math.sin(th) });
        }
        return pts;
    }

    gauss() {
        let u = 0, v = 0;
        while (!u) u = Math.random();
        while (!v) v = Math.random();
        return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
    }

    generateCones() {
        this.cones = this.fibSphere(this.cfg.coneCount);
    }

    generateGalaxies() {
        this.galaxies = [];
        for (const cone of this.cones) {
            // Build orthonormal frame for cone
            let ux, uy, uz;
            if (Math.abs(cone.ax) < 0.9) {
                ux = 0; uy = cone.az; uz = -cone.ay;
            } else {
                ux = -cone.az; uy = 0; uz = cone.ax;
            }
            const uLen = Math.sqrt(ux*ux + uy*uy + uz*uz);
            ux /= uLen; uy /= uLen; uz /= uLen;
            const vx = cone.ay * uz - cone.az * uy;
            const vy = cone.az * ux - cone.ax * uz;
            const vz = cone.ax * uy - cone.ay * ux;

            for (let k = 0; k < this.cfg.galaxiesPerCone; k++) {
                const dist      = Math.pow(Math.random(), 0.7) * this.cfg.maxDist3D;
                const spread    = Math.abs(this.gauss()) * dist * this.cfg.coneHalfAngle;
                const phi       = Math.random() * Math.PI * 2;
                const px = cone.ax * dist + (ux * Math.cos(phi) + vx * Math.sin(phi)) * spread;
                const py = cone.ay * dist + (uy * Math.cos(phi) + vy * Math.sin(phi)) * spread;
                const pz = cone.az * dist + (uz * Math.cos(phi) + vz * Math.sin(phi)) * spread;
                this.galaxies.push({
                    x: px, y: py, z: pz,
                    t: dist / this.cfg.maxDist3D,
                    size: 0.4 + Math.random() * 1.0,
                    phase: Math.random() * Math.PI * 2,
                });
            }
        }
    }

    project(x, y, z) {
        const cosP = Math.cos(this.precession);
        const sinP = Math.sin(this.precession);
        const rx =  x * cosP + z * sinP;
        const ry =  y;
        const wz = (-x * sinP + z * cosP) + this.cfg.focalLength;
        if (wz <= 0.01) return null;
        const scale = this.cfg.focalLength / wz;
        const span  = Math.min(this.canvas.width, this.canvas.height) * 0.48;
        return {
            sx: this.OX + rx * scale * span,
            sy: this.OY + ry * scale * span,
            wz, scale,
        };
    }

    redshiftColor(t, alpha) {
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        if (theme === 'light') {
            const r = Math.round(20  + t * 140);
            const g = Math.round(20  - t * 10);
            const b = Math.round(20  - t * 15);
            return `rgba(${r},${g},${b},${alpha})`;
        }
        const r = Math.round(180 + t * 75);
        const g = Math.round(210 - t * 150);
        const b = Math.round(255 - t * 200);
        return `rgba(${r},${g},${b},${alpha})`;
    }

    draw() {
        const W = this.canvas.width, H = this.canvas.height;
        const theme = document.documentElement.getAttribute('data-theme') || 'dark';
        this.ctx.clearRect(0, 0, W, H);
        this.ctx.fillStyle = theme === 'light' ? '#f5f5f0' : '#080a0f';
        this.ctx.fillRect(0, 0, W, H);

        // Depth-sort galaxies far→near
        const sorted = this.galaxies.slice().sort((a, b) => b.t - a.t);

        const now = performance.now();
        for (const g of sorted) {
            const p = this.project(g.x, g.y, g.z);
            if (!p) continue;
            if (p.sx < -20 || p.sx > W + 20 || p.sy < -20 || p.sy > H + 20) continue;

            const depthFade = Math.max(0, 1 - (p.wz - this.cfg.focalLength) / (this.cfg.maxDist3D * 0.9));
            const shimmer   = 0.75 + 0.25 * Math.sin(g.phase + now * 0.0009);
            const alpha     = depthFade * depthFade * shimmer * 0.55;
            if (alpha < 0.01) continue;

            const r = Math.max(0.3, g.size * p.scale * 2.2);
            this.ctx.beginPath();
            this.ctx.arc(p.sx, p.sy, r, 0, Math.PI * 2);
            this.ctx.fillStyle = this.redshiftColor(g.t, alpha);
            this.ctx.fill();
        }

        // Big Bang origin glow — large primordial fireball
        const layers = [
            { r: 220, a: 0.025 }, { r: 95, a: 0.11 },
            { r: 280, a: 0.52  }, { r: 100, a: 0.88 }, { r: 35, a: 1.0 },
        ];
        for (const l of layers) {
            const grd = this.ctx.createRadialGradient(this.OX, this.OY, 0, this.OX, this.OY, l.r);
            if (theme === 'light') {
                grd.addColorStop(0,   `rgba(10,10,10,${l.a})`);
                grd.addColorStop(0.2, `rgba(40,15,5,${l.a * 0.75})`);
                grd.addColorStop(1,   'rgba(0,0,0,0)');
            } else {
                grd.addColorStop(0,   `rgba(255,255,255,${l.a})`);
                grd.addColorStop(0.15,`rgba(255,240,200,${l.a * 0.85})`);
                grd.addColorStop(0.4, `rgba(200,225,255,${l.a * 0.55})`);
                grd.addColorStop(1,   'rgba(0,0,0,0)');
            }
            this.ctx.beginPath();
            this.ctx.arc(this.OX, this.OY, l.r, 0, Math.PI * 2);
            this.ctx.fillStyle = grd;
            this.ctx.fill();
        }

        // Vignette
        const vigEdge = theme === 'light' ? 'rgba(245,245,240,0.8)' : 'rgba(8,10,15,0.8)';
        const vig = this.ctx.createRadialGradient(
            this.OX, this.OY, Math.min(W,H)*0.2,
            this.OX, this.OY, Math.min(W,H)*0.9
        );
        vig.addColorStop(0, 'rgba(0,0,0,0)');
        vig.addColorStop(1, vigEdge);
        this.ctx.fillStyle = vig;
        this.ctx.fillRect(0, 0, W, H);
    }

    animate() {
        this.precession += this.cfg.precessionSpeed;
        this.draw();
        requestAnimationFrame(() => this.animate());
    }
}

// === NAVIGATION ===
class Navigation {
    constructor() {
        this.navbar = $('#navbar');
        this.navToggle = $('#nav-toggle');
        this.navMenu = $('#nav-menu');
        this.navLinks = $$('.nav-link');
        this.sections = $$('.section');
        
        this.init();
    }
    
    init() {
        this.setupScrollEffect();
        this.setupMobileMenu();
        this.setupSmoothScrolling();
        this.setupActiveNavigation();
        
        window.addEventListener('scroll', () => this.handleScroll());
    }
    
    setupScrollEffect() {
        const handleScroll = () => {
            if (window.scrollY > 50) {
                this.navbar.classList.add('scrolled');
            } else {
                this.navbar.classList.remove('scrolled');
            }
        };
        
        window.addEventListener('scroll', handleScroll);
    }
    
    setupMobileMenu() {
        this.navToggle.addEventListener('click', () => {
            this.navMenu.classList.toggle('active');
            this.navToggle.classList.toggle('active');
        });
        
        // Close mobile menu when clicking on a link
        this.navLinks.forEach(link => {
            link.addEventListener('click', () => {
                this.navMenu.classList.remove('active');
                this.navToggle.classList.remove('active');
            });
        });
    }
    
    setupSmoothScrolling() {
        // For separate pages, we don't need smooth scrolling
        // The navigation links already point to the correct HTML files
        // This method is kept for compatibility but does nothing
        return;
    }
    
    setupActiveNavigation() {
        const observerOptions = {
            root: null,
            rootMargin: '-50% 0px -50% 0px',
            threshold: 0
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    const targetId = `#${entry.target.id}`;
                    this.updateActiveNavLink(targetId);
                }
            });
        }, observerOptions);
        
        this.sections.forEach(section => {
            observer.observe(section);
        });
    }
    
    updateActiveNavLink(targetId) {
        this.navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === targetId) {
                link.classList.add('active');
            }
        });
    }
    
    handleScroll() {
        // Add any additional scroll handling here
    }
}

// === THEME TOGGLE ===
class ThemeToggle {
    constructor(cosmicWeb = null) {
        this.themeToggle = $('#theme-toggle');
        this.currentTheme = localStorage.getItem('theme') || 'dark';
        this.cosmicWeb = cosmicWeb;
        
        this.init();
    }
    
    init() {
        this.applyTheme(this.currentTheme);
        this.themeToggle.addEventListener('click', () => this.toggleTheme());
    }
    
    toggleTheme() {
        this.currentTheme = this.currentTheme === 'dark' ? 'light' : 'dark';
        this.applyTheme(this.currentTheme);
        localStorage.setItem('theme', this.currentTheme);
        
        // Force cosmic web to redraw with new theme colors
        if (this.cosmicWeb) {
            this.cosmicWeb.draw();
        }
    }
    
    applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        const icon = this.themeToggle.querySelector('i');
        
        if (theme === 'light') {
            icon.className = 'fas fa-sun';
        } else {
            icon.className = 'fas fa-moon';
        }
    }
}

// === ANIMATIONS ===
class ScrollAnimations {
    constructor() {
        this.animatedElements = $$('.research-card, .note-card, .travel-card, .timeline-item, .cv-section');
        this.init();
    }
    
    init() {
        this.setupIntersectionObserver();
    }
    
    setupIntersectionObserver() {
        const observerOptions = {
            root: null,
            rootMargin: '0px 0px -100px 0px',
            threshold: 0.1
        };
        
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('fade-in-up');
                    observer.unobserve(entry.target);
                }
            });
        }, observerOptions);
        
        this.animatedElements.forEach(element => {
            observer.observe(element);
        });
    }
}

// === FORM HANDLING ===
class ContactForm {
    constructor() {
        this.form = $('#contact-form');
        this.submitBtn = this.form.querySelector('.submit-btn');
        this.originalBtnText = this.submitBtn.innerHTML;
        
        this.init();
    }
    
    init() {
        this.form.addEventListener('submit', (e) => this.handleSubmit(e));
    }
    
    async handleSubmit(e) {
        e.preventDefault();
        
        const formData = new FormData(this.form);
        const data = Object.fromEntries(formData);
        
        // Show loading state
        this.setLoadingState(true);
        
        try {
            // Simulate form submission (replace with actual endpoint)
            await this.simulateFormSubmission(data);
            this.showSuccess();
            this.form.reset();
        } catch (error) {
            this.showError(error.message);
        } finally {
            this.setLoadingState(false);
        }
    }
    
    setLoadingState(loading) {
        if (loading) {
            this.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Sending...';
            this.submitBtn.disabled = true;
        } else {
            this.submitBtn.innerHTML = this.originalBtnText;
            this.submitBtn.disabled = false;
        }
    }
    
    async simulateFormSubmission(data) {
        // Simulate API call
        return new Promise((resolve, reject) => {
            setTimeout(() => {
                if (Math.random() > 0.1) { // 90% success rate for demo
                    resolve();
                } else {
                    reject(new Error('Failed to send message. Please try again.'));
                }
            }, 2000);
        });
    }
    
    showSuccess() {
        this.showNotification('Message sent successfully! I\'ll get back to you soon.', 'success');
    }
    
    showError(message) {
        this.showNotification(message, 'error');
    }
    
    showNotification(message, type) {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `notification ${type}`;
        notification.innerHTML = `
            <i class="fas ${type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'}"></i>
            <span>${message}</span>
        `;
        
        // Add styles
        notification.style.cssText = `
            position: fixed;
            top: 100px;
            right: 20px;
            background: ${type === 'success' ? '#28a745' : '#dc3545'};
            color: white;
            padding: 1rem 1.5rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.5rem;
            z-index: 10000;
            transform: translateX(100%);
            transition: transform 0.3s ease;
            box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
        `;
        
        document.body.appendChild(notification);
        
        // Animate in
        setTimeout(() => {
            notification.style.transform = 'translateX(0)';
        }, 100);
        
        // Remove after 5 seconds
        setTimeout(() => {
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.parentNode.removeChild(notification);
                }
            }, 300);
        }, 5000);
    }
}

// === UTILITY FUNCTIONS ===
function downloadCV() {
    // Create a simple PDF or link to CV
    const cvUrl = '#'; // Replace with actual CV URL
    
    if (cvUrl === '#') {
        // Show notification that CV download is not available yet
        showTempNotification('CV download will be available soon!', 'info');
        return;
    }
    
    const link = document.createElement('a');
    link.href = cvUrl;
    link.download = 'Sarah_Chen_CV.pdf';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function showTempNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.style.cssText = `
        position: fixed;
        top: 100px;
        right: 20px;
        background: #17a2b8;
        color: white;
        padding: 1rem 1.5rem;
        border-radius: 8px;
        z-index: 10000;
        transform: translateX(100%);
        transition: transform 0.3s ease;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
    `;
    notification.innerHTML = `<i class="fas fa-info-circle"></i> ${message}`;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(0)';
    }, 100);
    
    setTimeout(() => {
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => {
            if (notification.parentNode) {
                notification.parentNode.removeChild(notification);
            }
        }, 300);
    }, 3000);
}

// === PERFORMANCE OPTIMIZATIONS ===
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    }
}

// === INITIALIZATION ===
class App {
    constructor() {
        this.starField = null;
        this.navigation = null;
        this.themeToggle = null;
        this.scrollAnimations = null;
        this.contactForm = null;
        
        this.init();
    }
    
    init() {
        // Wait for DOM to be fully loaded
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => this.initializeComponents());
        } else {
            this.initializeComponents();
        }
    }
    
    initializeComponents() {
        try {
            // Initialize cosmic web visualization
            this.starField = new CosmicWeb('#starfield');
            
            // Initialize navigation
            this.navigation = new Navigation();
            
            // Initialize theme toggle (pass cosmic web for redrawing on theme change)
            this.themeToggle = new ThemeToggle(this.starField);
            
            // Initialize scroll animations
            this.scrollAnimations = new ScrollAnimations();
            
            // Initialize contact form
            this.contactForm = new ContactForm();
            
            // Add loading complete class
            document.body.classList.add('loaded');
            
            console.log('🌟 Astrophysics portfolio loaded successfully!');
        } catch (error) {
            console.error('Error initializing app:', error);
        }
    }
    
    destroy() {
        if (this.starField) {
            this.starField.destroy();
        }
    }
}

// === GLOBAL EVENT LISTENERS ===
window.addEventListener('beforeunload', () => {
    if (window.app) {
        window.app.destroy();
    }
});

// === START APPLICATION ===
window.app = new App();

// === ADDITIONAL FEATURES ===

// Typing effect for hero subtitle (optional enhancement)
function typeWriter(element, text, speed = 100) {
    let i = 0;
    element.innerHTML = '';
    
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        }
    }
    
    type();
}

// Mouse parallax effect for hero section (optional enhancement)
function addParallaxEffect() {
    const hero = $('#about');
    if (!hero) return;
    
    document.addEventListener('mousemove', throttle((e) => {
        const { clientX, clientY } = e;
        const { innerWidth, innerHeight } = window;
        
        const xPos = (clientX / innerWidth - 0.5) * 20;
        const yPos = (clientY / innerHeight - 0.5) * 20;
        
        hero.style.transform = `translate(${xPos}px, ${yPos}px)`;
    }, 50));
}

// Initialize additional features after a delay
setTimeout(() => {
    const heroSubtitle = $('.hero-subtitle');
    if (heroSubtitle && heroSubtitle.textContent) {
        const originalText = heroSubtitle.textContent;
        typeWriter(heroSubtitle, originalText, 80);
    }
    
    // Uncomment to enable parallax effect
    // addParallaxEffect();
}, 1000);

// === EXPORT FOR TESTING ===
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { App, CosmicWeb, Navigation, ThemeToggle, ContactForm };
}

// === TABLE OF CONTENTS TOGGLE ===
class TableOfContents {
    constructor() {
        this.floatBtn = document.getElementById('tocFloatBtn');
        this.sidebar = document.getElementById('tocSidebar');
        this.overlay = document.getElementById('tocOverlay');
        this.closeBtn = document.getElementById('tocCloseBtn');
        this.tocContent = document.getElementById('tocContent');
        this.tocLinks = [];
        this.sections = [];
        this.currentActive = null;
        this.isOpen = false;
        this.expandState = new Map(); // key: section id of li, value: boolean expanded
        
        if (this.floatBtn && this.sidebar) {
            this.init();
        }
    }
    
    init() {
        // Generate TOC from headings and collect sections
        this.generateTOC();
        this.collectSections();
        
        // Bind events
        this.floatBtn.addEventListener('click', () => this.toggle());
        this.closeBtn.addEventListener('click', () => this.close());
        this.overlay.addEventListener('click', () => this.close());
        
        // Handle TOC link clicks
        this.tocLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleLinkClick(e));
        });
        
        // Track scroll for active section
        window.addEventListener('scroll', throttle(() => this.updateActiveSection(), 100));
        window.addEventListener('resize', throttle(() => this.updateAnchorPosition(), 100));
        
        // Initial active section
        this.updateActiveSection();
        this.setInitialExpandStates();
        this.updateAnchorPosition();
        
        // Handle escape key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        });

        // Observe content changes to regenerate TOC automatically
        const noteBody = document.querySelector('.note-body');
        if (noteBody && 'MutationObserver' in window) {
            const observer = new MutationObserver(throttle(() => {
                this.generateTOC();
                this.collectSections();
                this.bindLinks();
                this.updateActiveSection();
                this.setInitialExpandStates();
            }, 300));
            observer.observe(noteBody, { childList: true, subtree: true });
            this.observer = observer;
        }
    }
    
    bindLinks() {
        // Remove previous listeners by replacing node list
        this.tocLinks.forEach(link => {
            link.addEventListener('click', (e) => this.handleLinkClick(e));
        });
    }

    ensureId(element) {
        if (element.id && element.id.trim().length > 0) return element.id;
        const text = (element.textContent || '').trim().toLowerCase();
        let slug = text
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
        if (!slug || slug === '-') slug = 'section';
        // Ensure uniqueness
        let unique = slug;
        let i = 1;
        while (document.getElementById(unique)) {
            unique = `${slug}-${i++}`;
        }
        element.id = unique;
        return unique;
    }

    generateTOC() {
        const container = this.tocContent;
        if (!container) return;

        const headings = document.querySelectorAll('.note-body h1, .note-body h2, .note-body h3');
        const list = document.createElement('ul');
        let currentH1 = null; // { li, id }
        let currentH2 = null; // { li, id }

        // Compute hierarchical numbering and prefix headings
        let h1Count = 0, h2Count = 0, h3Count = 0;
        const numberMap = new Map(); // id -> number string
        headings.forEach((h) => {
            const tag = h.tagName.toLowerCase();
            let num = '';
            if (tag === 'h1') {
                h1Count += 1; h2Count = 0; h3Count = 0;
                num = `${h1Count}`;
            } else if (tag === 'h2') {
                if (h1Count === 0) { h1Count = 1; }
                h2Count += 1; h3Count = 0;
                num = `${h1Count}.${h2Count}`;
            } else if (tag === 'h3') {
                if (h1Count === 0) { h1Count = 1; }
                if (h2Count === 0) { h2Count = 1; }
                h3Count += 1;
                num = `${h1Count}.${h2Count}.${h3Count}`;
            }
            const id = this.ensureId(h);
            numberMap.set(id, num);

            // Preserve original title and prefix visible heading with number
            const orig = h.dataset.origTitle || (h.textContent || '').trim();
            h.dataset.origTitle = orig;
            // Avoid duplicating numbers: rebuild from original
            h.innerHTML = `<span class="section-number">${num}</span> ${orig}`;
        });

        const createToggle = () => {
            const btn = document.createElement('button');
            btn.className = 'toc-toggle-sub';
            btn.setAttribute('type', 'button');
            btn.setAttribute('aria-expanded', 'true');
            btn.innerHTML = '<i class="fas fa-chevron-right"></i>';
            return btn;
        };

        const createLink = (id, text, number) => {
            const a = document.createElement('a');
            a.className = 'toc-link';
            a.setAttribute('data-section', id);
            a.href = `#${id}`;
            a.innerHTML = `<span class="toc-number">${number}</span> ${text}`;
            return a;
        };

        const createItem = (level, id, text, number, parentId = null, rootId = null) => {
            const li = document.createElement('li');
            li.className = `toc-item level${level}`;
            const a = createLink(id, text, number);
            if (parentId) a.setAttribute('data-parent', parentId);
            if (rootId) a.setAttribute('data-root', rootId);
            li.appendChild(a);
            return li;
        };

        headings.forEach((h) => {
            const tag = h.tagName.toLowerCase();
            const id = this.ensureId(h);
            const text = (h.dataset.origTitle || h.textContent || '').trim();
            const number = numberMap.get(id) || '';

            if (tag === 'h1') {
                const li = createItem(1, id, text, number);
                const sub = document.createElement('ul');
                sub.className = 'toc-sublist';
                // Toggle only added if subsections exist; we'll add after first child
                li.appendChild(sub);
                list.appendChild(li);
                currentH1 = { li, id, sub };
                currentH2 = null;
            } else if (tag === 'h2') {
                const li = createItem(2, id, text, number, currentH1?.id || null, currentH1?.id || null);
                const sub = document.createElement('ul');
                sub.className = 'toc-sublist';
                li.appendChild(sub);
                if (currentH1) {
                    currentH1.sub.appendChild(li);
                    // Add toggle to H1 if this is the first H2
                    if (!currentH1.li.querySelector('.toc-toggle-sub')) {
                        const toggle = createToggle();
                        currentH1.li.insertBefore(toggle, currentH1.li.querySelector('.toc-link').nextSibling);
                    }
                } else {
                    list.appendChild(li);
                }
                currentH2 = { li, id, sub };
            } else if (tag === 'h3') {
                const li = createItem(3, id, text, number, currentH2?.id || currentH1?.id || null, currentH1?.id || null);
                if (currentH2) {
                    currentH2.sub.appendChild(li);
                    // Add toggle to H2 if first H3
                    if (!currentH2.li.querySelector('.toc-toggle-sub')) {
                        const toggle = createToggle();
                        currentH2.li.insertBefore(toggle, currentH2.li.querySelector('.toc-link').nextSibling);
                    }
                } else if (currentH1) {
                    currentH1.sub.appendChild(li);
                } else {
                    list.appendChild(li);
                }
            }
        });

        // Top-level numbers already computed; no need to renumber here

        // Hide toggle buttons on items without children
        list.querySelectorAll('.toc-item').forEach((item) => {
            const sub = item.querySelector(':scope > .toc-sublist');
            const toggle = item.querySelector(':scope > .toc-toggle-sub');
            if (toggle) {
                if (!sub || !sub.children.length) {
                    toggle.remove();
                } else {
                    // Restore previous expand state or default expanded
                    const sectionId = item.querySelector(':scope > .toc-link')?.getAttribute('data-section');
                    const expanded = this.expandState.has(sectionId) ? this.expandState.get(sectionId) : true;
                    toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
                    if (!expanded) {
                        sub.style.maxHeight = '0px';
                    } else {
                        sub.style.maxHeight = `${sub.scrollHeight}px`;
                    }
                }
            }
        });

        // Replace content
        container.innerHTML = '';
        container.appendChild(list);

        // Update links cache & bind toggles
        this.tocLinks = Array.from(container.querySelectorAll('.toc-link'));
        this.bindLinks();

        // Bind toggle events
        this.bindToggleEvents();
    }

    collectSections() {
        this.sections = [];
        this.tocLinks.forEach(link => {
            const sectionId = link.getAttribute('data-section');
            const section = document.getElementById(sectionId);
            if (section) {
                this.sections.push({
                    id: sectionId,
                    element: section,
                    link: link
                });
            }
        });
    }
    
    toggle() {
        if (this.isOpen) {
            this.close();
        } else {
            this.open();
        }
    }
    
    open() {
        this.isOpen = true;
        this.sidebar.classList.add('active');
        this.overlay.classList.add('active');
        this.floatBtn.classList.add('active');
        document.body.style.overflow = 'hidden'; // Prevent background scroll on mobile
    }
    
    close() {
        this.isOpen = false;
        this.sidebar.classList.remove('active');
        this.overlay.classList.remove('active');
        this.floatBtn.classList.remove('active');
        document.body.style.overflow = ''; // Restore scroll
    }
    
    handleLinkClick(e) {
        e.preventDefault();
        const link = e.currentTarget;
        const sectionId = link.getAttribute('data-section');
        const targetElement = document.getElementById(sectionId);
        
        if (targetElement) {
            // Calculate offset for fixed navbar
            const navbarHeight = document.querySelector('.navbar')?.offsetHeight || 80;
            const offset = 20;
            const elementPosition = targetElement.getBoundingClientRect().top;
            const offsetPosition = elementPosition + window.pageYOffset - navbarHeight - offset;
            
            // Smooth scroll
            window.scrollTo({
                top: offsetPosition,
                behavior: 'smooth'
            });
            
            // Close sidebar on mobile after clicking
            if (window.innerWidth <= 768) {
                setTimeout(() => this.close(), 300);
            }
            
            // Update active state immediately
            this.setActiveLink(link);
        }
    }
    
    updateActiveSection() {
        const scrollPosition = window.pageYOffset + window.innerHeight / 3;
        
        let currentSection = null;
        
        // Find the current section based on scroll position
        for (let i = this.sections.length - 1; i >= 0; i--) {
            const section = this.sections[i];
            const sectionTop = section.element.offsetTop;
            
            if (scrollPosition >= sectionTop) {
                currentSection = section;
                break;
            }
        }
        
        // Update active link if section changed
        if (currentSection && currentSection.link !== this.currentActive) {
            this.setActiveLink(currentSection.link);
        }
    }
    
    setActiveLink(link) {
        // Remove active states
        this.tocLinks.forEach(l => {
            l.classList.remove('active');
            l.classList.remove('active-parent');
        });
        
        // Add active class to current link
        if (link) {
            link.classList.add('active');
            this.currentActive = link;

            // Highlight parents
            const parentId = link.getAttribute('data-parent');
            const rootId = link.getAttribute('data-root');
            const parentLink = parentId ? this.tocLinks.find(l => l.getAttribute('data-section') === parentId) : null;
            const rootLink = rootId ? this.tocLinks.find(l => l.getAttribute('data-section') === rootId) : null;
            if (parentLink) parentLink.classList.add('active-parent');
            if (rootLink && rootLink !== parentLink) rootLink.classList.add('active-parent');
            
            // Scroll link into view within sidebar
            const sidebar = document.querySelector('.toc-content');
            if (sidebar && link) {
                const linkTop = link.offsetTop;
                const linkHeight = link.offsetHeight;
                const sidebarHeight = sidebar.offsetHeight;
                const sidebarScroll = sidebar.scrollTop;
                
                // Check if link is outside visible area
                if (linkTop < sidebarScroll || linkTop + linkHeight > sidebarScroll + sidebarHeight) {
                    sidebar.scrollTo({
                        top: linkTop - sidebarHeight / 2 + linkHeight / 2,
                        behavior: 'smooth'
                    });
                }
            }
        }
    }

    bindToggleEvents() {
        const toggles = this.tocContent.querySelectorAll('.toc-toggle-sub');
        toggles.forEach((btn) => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                const item = btn.closest('.toc-item');
                const sub = item?.querySelector(':scope > .toc-sublist');
                const sectionId = item?.querySelector(':scope > .toc-link')?.getAttribute('data-section');
                if (!sub || !sectionId) return;
                const expanded = btn.getAttribute('aria-expanded') === 'true';
                this.expandState.set(sectionId, !expanded);
                this.animateSublist(sub, !expanded);
                btn.setAttribute('aria-expanded', !expanded ? 'true' : 'false');
                // Ensure expanded content stays accessible within scrollable container
                if (!expanded) {
                    // If we just expanded, nudge scroll to reveal new content if clipped
                    this.ensureVisibleInSidebar(sub);
                }
            });
        });
    }

    animateSublist(sub, expand) {
        // Clean previous transitionend listener
        sub.ontransitionend = null;

        if (expand) {
            sub.style.display = 'block';
            // Set from 0 to measured height for animation
            sub.style.maxHeight = sub.scrollHeight + 'px';
            // After transition completes, set to none so content can grow naturally
            sub.ontransitionend = (e) => {
                if (e.propertyName === 'max-height') {
                    sub.style.maxHeight = 'none';
                    sub.ontransitionend = null;
                }
            };
        } else {
            // If currently 'none', set to current height then animate to 0
            if (sub.style.maxHeight === 'none' || !sub.style.maxHeight) {
                sub.style.maxHeight = sub.scrollHeight + 'px';
                // Force reflow
                // eslint-disable-next-line no-unused-expressions
                sub.offsetHeight;
            }
            sub.style.maxHeight = '0px';
            sub.ontransitionend = (e) => {
                if (e.propertyName === 'max-height') {
                    // Optionally hide after collapse
                    sub.style.display = 'block'; // keep accessible for measurement
                    sub.ontransitionend = null;
                }
            };
        }
    }

    ensureVisibleInSidebar(element) {
        const sidebar = document.querySelector('.toc-content');
        if (!sidebar || !element) return;
        const elTop = element.getBoundingClientRect().top;
        const elBottom = element.getBoundingClientRect().bottom;
        const sbTop = sidebar.getBoundingClientRect().top;
        const sbBottom = sidebar.getBoundingClientRect().bottom;
        if (elBottom > sbBottom) {
            const delta = elBottom - sbBottom + 24; // some padding
            sidebar.scrollBy({ top: delta, behavior: 'smooth' });
        } else if (elTop < sbTop) {
            const delta = elTop - sbTop - 24;
            sidebar.scrollBy({ top: delta, behavior: 'smooth' });
        }
    }

    setInitialExpandStates() {
        // Determine current active or hash target to expand ancestors
        let activeId = null;
        if (location.hash && document.getElementById(location.hash.slice(1))) {
            activeId = location.hash.slice(1);
        } else if (this.currentActive) {
            activeId = this.currentActive.getAttribute('data-section');
        } else if (this.sections.length) {
            activeId = this.sections[0].id;
        }

        // Default: collapse all groups unless previously stored in expandState
        const items = this.tocContent.querySelectorAll('.toc-item');
        items.forEach((item) => {
            const link = item.querySelector(':scope > .toc-link');
            const sub = item.querySelector(':scope > .toc-sublist');
            const toggle = item.querySelector(':scope > .toc-toggle-sub');
            if (!sub || !toggle || !link) return;
            const id = link.getAttribute('data-section');
            let expanded = this.expandState.has(id) ? this.expandState.get(id) : false;

            // If this is an ancestor of active, force expand
            if (!expanded && activeId) {
                const isAncestor = this.isAncestorOf(id, activeId);
                if (isAncestor) expanded = true;
            }

            toggle.setAttribute('aria-expanded', expanded ? 'true' : 'false');
            if (expanded) {
                sub.style.maxHeight = sub.scrollHeight + 'px';
            } else {
                sub.style.maxHeight = '0px';
            }
        });
    }

    isAncestorOf(ancestorId, targetId) {
        // Walk up via data-parent to see if ancestorId appears
        let current = this.tocLinks.find(l => l.getAttribute('data-section') === targetId);
        const guard = 50; let i = 0;
        while (current && i++ < guard) {
            const parent = current.getAttribute('data-parent');
            if (!parent) return false;
            if (parent === ancestorId) return true;
            current = this.tocLinks.find(l => l.getAttribute('data-section') === parent);
        }
        return false;
    }

    updateAnchorPosition() {
        const article = document.querySelector('.note-article');
        const navbar = document.querySelector('.navbar');
        if (!article) return;

        const rect = article.getBoundingClientRect();
        const contentLeft = rect.left; // viewport-relative
        const gap = 16; // px gap between sidebar and content edge
        const buttonGap = 10;
        const sidebarWidth = this.sidebar.offsetWidth || 320;
        const buttonWidth = this.floatBtn.offsetWidth || 60;

        // Mobile: default positions
        if (window.innerWidth <= 768) {
            document.documentElement.style.setProperty('--toc-left', '0px');
            document.documentElement.style.setProperty('--toc-button-left', '15px');
            const top = (navbar?.offsetHeight || 80) + 10;
            document.documentElement.style.setProperty('--toc-button-top', `${top}px`);
            return;
        }

        // Desktop: anchor to content left edge
        const sidebarLeft = Math.max(0, contentLeft - sidebarWidth - gap);
        const buttonLeft = Math.max(0, contentLeft - buttonWidth - buttonGap);
        const top = (navbar?.offsetHeight || 80) + 40;

        document.documentElement.style.setProperty('--toc-left', `${sidebarLeft}px`);
        document.documentElement.style.setProperty('--toc-button-left', `${buttonLeft}px`);
        document.documentElement.style.setProperty('--toc-button-top', `${top}px`);
    }
}

// Initialize TOC when DOM is loaded
let tocInstance = null;

function initTableOfContents() {
    tocInstance = new TableOfContents();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTableOfContents);
} else {
    initTableOfContents();
}
