document.addEventListener("DOMContentLoaded", function () {
    const footerHTML = `
        <footer style="
            text-align: center; 
            margin-top: 220px; 
            font-size: 12px;
            font-weight: bolder;
            color: white; 
            background-color: #333; 
            padding: 15px; 
            position: relative;
            bottom: 0;
            width: 100%;">
            @2025 Lens-Prescription-App developed by <strong>MANITEJA (MNR DEVELOPERS)</strong>
        </footer>
    `;
    document.body.insertAdjacentHTML("beforeend", footerHTML);
});
