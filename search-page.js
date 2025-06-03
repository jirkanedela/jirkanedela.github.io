// List of all HTML files to search through
const pages = [
  'europe.html',
  'north-america.html',
  'africa.html',
  'asia.html',
  'south-america.html',
  'oceania.html',
  'middle-east.html',
  'russia.html'
];

// Calculate relevance score for a match
function calculateRelevanceScore(match, query) {
  let score = 0;
  const lowerQuery = query.toLowerCase();
  const lowerTitle = match.sectionTitle.toLowerCase();
  const lowerExcerpt = match.excerpt.toLowerCase();

  // Odstraníme pomlčky pro účely porovnávání
  const cleanQuery = lowerQuery.replace(/-/g, '');
  const cleanTitle = lowerTitle.replace(/-/g, '');
  const cleanExcerpt = lowerExcerpt.replace(/-/g, '');

  // 1. Absolutní priorita - přesná shoda celého textu
  if (cleanTitle === cleanQuery || cleanExcerpt.includes(` ${cleanQuery} `)) {
    score += 1000;
  }

  // 2. Jednopísmenné dotazy - speciální zacházení
  if (query.length === 1) {
    const titleWords = cleanTitle.split(/\s+/);
    const excerptWords = cleanExcerpt.split(/\s+/);
    
    // Přesná shoda samostatného písmene
    if (titleWords.includes(cleanQuery)) {
      score += 800;
    }
    if (excerptWords.includes(cleanQuery)) {
      score += 600;
    }

    // Slova začínající na hledané písmeno
    const titleMatches = titleWords.filter(word => word.startsWith(cleanQuery));
    const excerptMatches = excerptWords.filter(word => word.startsWith(cleanQuery));

    // Penalizace za delší slova
    titleMatches.forEach(match => {
      score += 400 / Math.pow(match.length, 1.5);
    });
    excerptMatches.forEach(match => {
      score += 200 / Math.pow(match.length, 1.5);
    });
  }
  // 3. Označení cest
  else if (/^[A-Z][-]?\d+$|^[A-Z]{2}[-]?\d+$/.test(query)) {
    // Hledání v nadpisu
    const titleRoadMatches = match.sectionTitle.match(/[A-Z][-]?\d+|[A-Z]{2}[-]?\d+/g) || [];
    for (const road of titleRoadMatches) {
      const cleanRoad = road.replace(/-/g, '').toLowerCase();
      if (cleanRoad === cleanQuery) {
        score += 700;
      } else if (cleanRoad.startsWith(cleanQuery)) {
        score += 500;
      }
    }

    // Hledání v textu
    const excerptRoadMatches = match.excerpt.match(/[A-Z][-]?\d+|[A-Z]{2}[-]?\d+/g) || [];
    for (const road of excerptRoadMatches) {
      const cleanRoad = road.replace(/-/g, '').toLowerCase();
      if (cleanRoad === cleanQuery) {
        score += 400;
      } else if (cleanRoad.startsWith(cleanQuery)) {
        score += 300;
      }
    }
  }
  // 4. Obecné vyhledávání - zaměřené na začátky slov
  else {
    const titleWords = cleanTitle.split(/\s+/);
    const excerptWords = cleanExcerpt.split(/\s+/);

    // Hledání slov začínajících na dotaz v nadpisu
    const titleMatches = titleWords.filter(word => word.startsWith(cleanQuery));
    titleMatches.forEach(match => {
      // Vyšší skóre pro kratší slova (přesnější shody)
      score += 300 / Math.pow(match.length - cleanQuery.length + 1, 1.2);
    });

    // Hledání slov začínajících na dotaz v textu
    const excerptMatches = excerptWords.filter(word => word.startsWith(cleanQuery));
    excerptMatches.forEach(match => {
      score += 150 / Math.pow(match.length - cleanQuery.length + 1, 1.2);
    });
  }

  // 5. Bonus za kontext
  const contextKeywords = ['highway', 'route', 'road', 'cesta', 'silnice', 'dálnice', 'motorway', 'autostrada', 'autoroute'];
  for (const keyword of contextKeywords) {
    if (lowerExcerpt.includes(keyword)) {
      score += 30;
    }
  }

  return score;
}

// Get related content from the same page
function getRelatedContent(section, allSections) {
  const related = [];
  const currentIndex = Array.from(allSections).indexOf(section);
  
  // Get 2 sections before and after, ensuring they exist
  for (let i = Math.max(0, currentIndex - 2); i <= Math.min(allSections.length - 1, currentIndex + 2); i++) {
    const relatedSection = allSections[i];
    // Check if the related section is a valid element before trying to get its title
    if (i !== currentIndex && relatedSection instanceof Element) {
       const title = relatedSection.querySelector('h2, summary')?.textContent;
       // Only add if title is found and it's not an empty string
       if (title && title.trim() !== '') {
         // Use data-section-id attribute for precise navigation
         const sectionId = relatedSection.id || `section-${i}`; // Fallback to index-based ID if no ID exists
          related.push({
            title: title,
            url: `#${sectionId}` // Link to the section by its ID
          });
       }
    }
  }
  
  return related;
}

async function searchPages(query) {
  const results = [];
  const lowerQuery = query.toLowerCase();
  
  for (const page of pages) {
    try {
      const response = await fetch(page);
      if (!response.ok) {
           console.warn(`Could not fetch ${page}: ${response.status}`);
           continue;
      }
      const text = await response.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, 'text/html');
      
      // Extract all text content
      const bodyContent = doc.body ? doc.body.textContent.toLowerCase() : '';

      // Rychlá kontrola, jestli stránka vůbec obsahuje hledaný text
      if (bodyContent.includes(lowerQuery)) {
        const title = doc.querySelector('h1')?.textContent || page;
        const sections = doc.querySelectorAll('section, details');
        const matches = [];
        
        sections.forEach((section, index) => {
          // Assign a unique ID to sections if they don't have one
          if (!section.id) {
              section.id = `section-${index}`;
          }
          
          // Získáme všechen text ze sekce
          const sectionText = section.textContent;
          const sectionTextLower = sectionText.toLowerCase();
          
          // Získáme nadpis sekce
          const sectionTitle = section.querySelector('h2, summary')?.textContent || section.id;
          const sectionTitleLower = sectionTitle.toLowerCase();

          // Kontrola, jestli sekce obsahuje hledaný text nebo číslo cesty
          if (sectionTextLower.includes(lowerQuery) || 
              // Hledání označení cest: A1, M25, E65, atd.
              sectionText.match(new RegExp(`[A-Z][-]?\\d+|[A-Z]{2}[-]?\\d+`, 'g'))?.some(road => 
                road.toLowerCase().includes(lowerQuery)
              )) {
            
            // Najdeme kontext kolem shody
            let excerptStart = -1;
            let excerptEnd = -1;
            
            // Nejdřív zkusíme najít shodu v označení cest
            const roadMatches = sectionText.match(new RegExp(`[A-Z][-]?\\d+|[A-Z]{2}[-]?\\d+`, 'g')) || [];
            for (const road of roadMatches) {
              if (road.toLowerCase().includes(lowerQuery)) {
                const matchIndex = sectionText.indexOf(road);
                if (matchIndex !== -1) {
                  excerptStart = Math.max(0, matchIndex - 100);
                  excerptEnd = Math.min(sectionText.length, matchIndex + road.length + 100);
                  break;
                }
              }
            }
            
            // Pokud jsme nenašli shodu v označení cest, hledáme obecnou shodu
            if (excerptStart === -1) {
              const matchIndex = sectionTextLower.indexOf(lowerQuery);
              if (matchIndex !== -1) {
                excerptStart = Math.max(0, matchIndex - 100);
                excerptEnd = Math.min(sectionText.length, matchIndex + query.length + 100);
              }
            }
            
            let excerpt = sectionText.substring(excerptStart, excerptEnd);
            if (excerptStart > 0) excerpt = '...' + excerpt;
            if (excerptEnd < sectionText.length) excerpt += '...';
            
            // Zvýrazníme shodu v excerptu
            const highlightedExcerpt = excerpt.replace(
              new RegExp(`(${query}|[A-Z][-]?\\d+|[A-Z]{2}[-]?\\d+)`, 'gi'),
              match => match.toLowerCase().includes(lowerQuery) ? `<mark>${match}</mark>` : match
            );
            
            matches.push({
              excerpt: highlightedExcerpt,
              sectionId: section.id,
              sectionTitle: sectionTitle,
              relevanceScore: calculateRelevanceScore({
                excerpt: excerpt,
                sectionTitle: sectionTitle
              }, query),
              relatedContent: getRelatedContent(section, sections)
            });
          }
        });

        if (matches.length > 0) {
          matches.sort((a, b) => b.relevanceScore - a.relevanceScore);
          
          results.push({
            title: title,
            matches: matches,
            url: page,
            relevanceScore: matches.reduce((sum, match) => sum + match.relevanceScore, 0)
          });
        }
      }
    } catch (error) {
      console.error(`Error searching ${page}:`, error);
    }
  }

  results.sort((a, b) => b.relevanceScore - a.relevanceScore);
  return results;
}

async function performSearch(query) {
  const searchPageResults = document.getElementById('searchPageResults');
  if (!searchPageResults) { // Add safety check
      console.error('searchPageResults element not found!');
      return;
  }
  searchPageResults.innerHTML = '<div class="loading">Searching...</div>';

  try {
    const results = await searchPages(query);
    displaySearchPageResults(results, query);
  } catch (error) {
    console.error('Search failed:', error);
    searchPageResults.innerHTML = '<div class="error">Search failed. Please try again.</div>';
  }
}

// Function to display results on the search results page
function displaySearchPageResults(results, query) {
  const searchPageResults = document.getElementById('searchPageResults');
    if (!searchPageResults) return; // Safety check
  
  if (results.length === 0) {
    searchPageResults.innerHTML = `
      <div class="no-results">
        <h2>No results found for "${query}"</h2>
        <p>Try different keywords or check your spelling.</p>
      </div>
    `;
    return;
  }

  let resultsHtml = `
    <div class="search-stats">
      <h2>Search results for "${query}"</h2>
      <p>Found ${results.length} pages with matching content</p>
    </div>
  `;

  results.forEach(result => {
    let matchesHtml = '';
    result.matches.forEach(match => {
      const relatedContentHtml = match.relatedContent.length > 0 ? `
        <div class="related-content">
          <h5>You might also be interested in:</h5>
          <ul>
            ${match.relatedContent.map(related => `
              <li><a href="${result.url}${related.url}">${related.title}</a></li>
            `).join('')}
          </ul>
        </div>
      ` : '';

      matchesHtml += `
        <div class="search-match" data-url="${result.url}" data-section-id="${match.sectionId}">
          <div class="match-header">
            <h4>${match.sectionTitle}</h4>
            <span class="match-url">${result.url}</span>
          </div>
          <p class="match-excerpt">${match.excerpt}</p>
          ${relatedContentHtml}
        </div>
      `;
    });

    resultsHtml += `
      <div class="search-result-group">
        <h3>${result.title}</h3>
        ${matchesHtml}
      </div>
    `;
  });

  searchPageResults.innerHTML = resultsHtml;

  // Add click handlers to the newly added elements
  const matches = searchPageResults.querySelectorAll('.search-match');
  matches.forEach(matchElement => {
    matchElement.addEventListener('click', (e) => {
      // Prevent default link behavior for related content links
      if (e.target.tagName === 'A') {
        return; 
      }
      
      // Navigate to the section when clicking the match container
      const url = matchElement.getAttribute('data-url');
      const sectionId = matchElement.getAttribute('data-section-id');
      const query = document.getElementById('searchInput')?.value.trim(); // Get current query

      if (url && sectionId) {
           // Pass the query to the target page URL for highlighting
           window.location.href = `${url}?q=${encodeURIComponent(query)}#${sectionId}`;
      } else if (url) {
            window.location.href = url;
      }
    });
  });

     // handleHashNavigation is now called on the target page
  }

// This function is for navigating to sections and highlighting on the target page
// This function needs to be included in ALL content HTML files script blocks.
function handlePageLoadAndHashNavigation() {
    const hash = window.location.hash;
    const urlParams = new URLSearchParams(window.location.search);
    const query = urlParams.get('query'); // Get the query from the URL parameter

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
        if (!parent || parent.tagName === 'SCRIPT' || parent.tagName === 'STYLE' || parent.tagName === 'MARK') {
            return;
        }

        const text = textNode.nodeValue;
        if (!text) return;

        // Rozdělíme text na slova a zachováme oddělovače
        const parts = text.split(/(\s+|[.,!?;])/);
        let modified = false;

        for (let i = 0; i < parts.length; i++) {
            if (parts[i].toLowerCase().startsWith(lowerCaseQuery)) {
                parts[i] = `<mark>${parts[i]}</mark>`;
                modified = true;
            }
        }

        if (modified) {
            const newElement = document.createElement('span');
            newElement.innerHTML = parts.join('');
            parent.replaceChild(newElement, textNode);
        }
    });
}

// Initial call on search.html load to handle the query in the URL
document.addEventListener('DOMContentLoaded', () => {
  const searchInput = document.getElementById('searchInput');
  // searchPageResults is handled within performSearch and displaySearchPageResults now
  
  // Get search query from URL on search.html
  const urlParams = new URLSearchParams(window.location.search);
  const query = urlParams.get('q');

  if (query) {
    // Populate the search input on search.html
    if(searchInput) searchInput.value = query;
    performSearch(query); // performSearch is in global scope
  }

  // Handle search form submission from the search page bar
  if(searchInput) {
      searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const newQuery = searchInput.value.trim();
          if (newQuery.length >= 1) {
            // Redirect to search.html with the new query
            window.location.href = `search.html?q=${encodeURIComponent(newQuery)}`;
          }
        }
      });
  }

   // handleHashNavigation is not needed on search.html itself in this structure
   // but the logic for handling hash and highlighting IS needed on the target pages.

}); // End DOMContentLoaded for search-page.js

// The handlePageLoadAndHashNavigation and highlightTextInElement functions
// need to be included in the <script> tag of index.html and all content pages (europe.html, etc.).
// They should run immediately when those pages load.

// Example of what needs to be added to EACH content HTML file:
/*
<script>
// Include the handlePageLoadAndHashNavigation and highlightTextInElement functions here

document.addEventListener('DOMContentLoaded', () => {
    handlePageLoadAndHashNavigation(); // Run highlighting and scrolling on content pages
});

// Also listen for hash changes on the content pages
window.addEventListener('hashchange', handlePageLoadAndHashNavigation);
</script>
*/ 