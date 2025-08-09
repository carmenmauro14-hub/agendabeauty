
document.addEventListener('DOMContentLoaded', function () {
  // Inserisce manifest e icone nel <head>
  const head = document.head;

  const manifest = document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = "manifest.json";
  head.appendChild(manifest);

  const icon192 = document.createElement("link");
  icon192.rel = "icon";
  icon192.href = "icons/icon-192.png";
  icon192.type = "image/png";
  head.appendChild(icon192);

  const appleIcon = document.createElement("link");
  appleIcon.rel = "apple-touch-icon";
  appleIcon.href = "icons/icon-192.png";
  head.appendChild(appleIcon);

  // Carica la navbar dinamicamente
  fetch("navbar.html")
    .then(response => response.text())
    .then(data => {
      document.getElementById("navbar-placeholder").innerHTML = data;

      // Attiva la voce attuale nella navbar
      const currentPage = window.location.pathname.split("/").pop();
      document.querySelectorAll('.top-nav a').forEach(link => {
        if (link.getAttribute("href") === currentPage) {
          link.classList.add("active");
        }
      });

      // Effetto fade-out al cambio pagina
      document.querySelectorAll('.top-nav a').forEach(link => {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          document.body.classList.add('fade-out');
          const href = this.getAttribute('href');
          setTimeout(() => window.location.href = href, 200);
        });
      });
    });
});
