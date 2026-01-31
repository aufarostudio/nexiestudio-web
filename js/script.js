document.addEventListener('DOMContentLoaded', () => {
    // Mobile Menu
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    hamburger.addEventListener('click', () => {
        hamburger.classList.toggle('active');
        navLinks.classList.toggle('active');
    });

    document.querySelectorAll('.nav-links li a').forEach(link => {
        link.addEventListener('click', () => {
            hamburger.classList.remove('active');
            navLinks.classList.remove('active');
        });
    });

    // Parallax Effect on Scroll
    window.addEventListener('scroll', () => {
        const scrolled = window.pageYOffset;
        
        // Parallax for hero elements (subtle)
        const parallaxElements = document.querySelectorAll('[data-speed]');
        
        parallaxElements.forEach(el => {
            const speed = el.getAttribute('data-speed');
            const yPos = -(scrolled * speed);
            el.style.transform = `translateY(${yPos}px)`;
        });
        
        // Navbar transparency on scroll
        const navbar = document.querySelector('.navbar');
        if (scrolled > 50) {
            navbar.style.background = 'rgba(5, 5, 16, 0.95)';
        } else {
            navbar.style.background = 'rgba(5, 5, 16, 0.8)';
        }
    });

    // Mouse Move Parallax (Hero Background)
    const heroSection = document.querySelector('.hero');
    const orbs = document.querySelectorAll('.glow-orb');

    heroSection.addEventListener('mousemove', (e) => {
        const x = e.clientX / window.innerWidth;
        const y = e.clientY / window.innerHeight;

        orbs.forEach((orb, index) => {
            const speed = (index + 1) * 20;
            const xOffset = (x - 0.5) * speed;
            const yOffset = (y - 0.5) * speed;
            
            orb.style.transform = `translate(${xOffset}px, ${yOffset}px)`;
        });
    });

    // Reveal on Scroll (Simple Intersection Observer)
    const observerOptions = {
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.style.opacity = '1';
                entry.target.style.transform = 'translateY(0)';
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    // Add initial styles for reveal elements
    const revealElements = document.querySelectorAll('.service-card, .section-title, .contact-box');
    revealElements.forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(30px)';
        el.style.transition = 'all 0.6s ease-out';
        observer.observe(el);
    });
});
