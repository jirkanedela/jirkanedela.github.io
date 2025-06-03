// This script is primarily for the index.html page.
// It handles the search bar submission and redirects to the search results page.
// It also includes the logic for handling hash navigation and highlighting
// which needs to be present on ALL content pages (index.html, europe.html, etc.).

document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');

  // Handle search form submission on index.html
  if (searchInput) { // Check if searchInput exists on the page
    searchInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const query = searchInput.value.trim();
        if (query.length >= 2) {
          // Redirect to search.html with the query
          window.location.href = `search.html?q=${encodeURIComponent(query)}`;
        }
      }
    });
  }

  // Call the hash navigation and highlighting logic on DOM ready for index.html
  handlePageLoadAndHashNavigation();
});

// Listen for hash changes on index.html
window.addEventListener('hashchange', handlePageLoadAndHashNavigation);


// --- Functions below need to be included in ALL content HTML files script blocks ---

// This function is for navigating to sections and highlighting on the target page
function handlePageLoadAndHashNavigation() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('q'); // Get the query from the URL parameter

    if (hash) {
      const element = document.querySelector(hash);
      if (element) {
        // Open details element if it's the target
        if (element.tagName.toLowerCase() === 'details') {
          element.open = true;
        }

        // Scroll to the element smoothly
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
        
        // Highlight the matched text within the element if query is present
        if (query) {
             highlightTextInElement(element, query);
        }

        // Add a class for temporary section highlighting (optional, can be styled)
        // element.classList.add('highlight-section');
        // setTimeout(() => {
        //   element.classList.remove('highlight-section');
        // }, 3000); // Highlight for 3 seconds
      }
    }
     // If there's a query but no hash, just highlight all occurrences on the page
     else if (query) {
         highlightTextInElement(document.body, query);
     }
  }
  
// Function to highlight text within a given element
function highlightTextInElement(element, query) {
    if (!element || !query) return;

    const lowerCaseQuery = query.toLowerCase();
    const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT, null, false);

    const textNodes = [];
    let node;
    while ((node = walker.nextNode())) {
        textNodes.push(node);
    }

    textNodes.forEach(textNode => {
        const parent = textNode.parentNode;
        // Avoid highlighting within script, style, or already marked elements
        if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'MARK') {
            return;
        }

        const text = textNode.nodeValue;
        if (!text) return;

        const lowerCaseText = text.toLowerCase();
        let lastIndex = 0;
        const fragment = document.createDocumentFragment();

        let match;
        // Use a regular expression to find all occurrences, ensuring word boundaries or handling punctuation
        // This simple regex looks for the query string, adjust if needed for word boundaries
        const regex = new RegExp(lowerCaseQuery.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'); // Case-insensitive global regex

        while ((match = regex.exec(lowerCaseText)) !== null) {
            // Append text before the match
            fragment.appendChild(document.createTextNode(text.substring(lastIndex, match.index)));

            // Create and append the highlight element
            const mark = document.createElement('mark');
            mark.textContent = text.substring(match.index, regex.lastIndex);
            fragment.appendChild(mark);

            lastIndex = regex.lastIndex;
        }

        // Append remaining text after the last match
        fragment.appendChild(document.createTextNode(text.substring(lastIndex)));

        // Replace the original text node with the new fragment
        if (fragment.childNodes.length > 0) {
            parent.replaceChild(fragment, textNode);
        }
    });
}
