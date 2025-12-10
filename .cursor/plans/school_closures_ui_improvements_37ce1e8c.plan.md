---
name: School Closures UI Improvements
overview: Enhance the school closures frontend with better UX, statistics dashboard, search functionality, improved visual hierarchy, and default to Oakland Schools filter. Leverage new API metadata and ISD status data for richer user experience.
todos:
  - id: update-api-structure
    content: Update Closures.svelte to handle new API response structure (closures, metadata, isdStatus)
    status: pending
  - id: change-default-filter
    content: Change default isdFilter to 'Oakland Schools' in +page.svelte and update session storage logic
    status: pending
  - id: add-statistics-dashboard
    content: Add statistics dashboard component showing total schools, closed schools, and ISD-level stats
    status: pending
    dependencies:
      - update-api-structure
  - id: implement-search
    content: Add search functionality using /api/closures/school/:schoolName endpoint with debouncing
    status: pending
    dependencies:
      - update-api-structure
  - id: enhance-visual-display
    content: Add ISD status badges, school status badges, collapsible sections, and match score display
    status: pending
    dependencies:
      - update-api-structure
  - id: improve-layout-typography
    content: Enhance layout with card-based design, better spacing, and improved mobile responsiveness
    status: pending
  - id: enhance-error-handling
    content: Display metadata.fetchError, improve error messages, and show data freshness warnings
    status: pending
    dependencies:
      - update-api-structure
  - id: improve-loading-states
    content: Replace text loading with spinner animation and skeleton loaders
    status: pending
---

# School Closures Frontend Improvements

## Overview

Enhance the school closures application with improved UI/UX, statistics dashboard, search functionality, and better data visualization. Update to use the new API response structure with metadata and ISD status information.

## Key Changes

### 1. API Response Structure Update

- Update `Closures.svelte` to handle new API response structure:
- Extract `closures`, `metadata`, and `isdStatus` from response
- Currently code expects direct closures object, but API now returns `{ closures: {...}, metadata: {...}, isdStatus: {...} }`

### 2. Default Filter Change

- Change default `isdFilter` from `'all'` to `'Oakland Schools'` in [src/routes/+page.svelte](src/routes/+page.svelte)
- Update session storage logic to default to Oakland Schools if no stored preference
- Keep "All ISDs" as an option in the dropdown

### 3. Statistics Dashboard

- Add summary cards at the top showing:
- Total schools count
- Closed schools count
- Open schools count
- ISD-level statistics (fully closed, partially closed, fully open)
- Use `metadata` and `isdStatus` from API response
- Display prominently when viewing "All ISDs"

### 4. Search Functionality

- Add search input field to search for schools by name
- Use `/api/closures/school/:schoolName` endpoint
- Implement debouncing for search queries
- Show search results with school, ISD, county, and status
- Clear search button

### 5. Enhanced Visual Display

- **ISD Status Indicators**: 
- Show badges/icons for ISD-level status (all closed, partially closed, fully open)
- Use `isdStatus.allClosed`, `closedCount`, `totalCount` from API
- **School Status Badges**: 
- Replace text with visual badges/icons for closed/open
- Use color coding (red for closed, green for open)
- **Collapsible Sections**: 
- Make ISD and county sections collapsible/expandable
- Show counts in headers (e.g., "Oakland Schools (5 closed / 20 total)")
- **Match Score Display**: 
- Show confidence indicator if `matchScore` is available
- Display `originalStatus` if different from boolean closed status

### 6. Improved Layout & Typography

- Better spacing and visual hierarchy
- Card-based layout for ISD blocks
- Improved mobile responsiveness
- Better contrast and readability
- Add icons for visual interest (closed/open indicators, search icon, etc.)

### 7. Enhanced Error Handling

- Display `metadata.fetchError` if present (graceful degradation message)
- Better error messages and retry functionality
- Show data freshness warnings if data is stale

### 8. Loading States

- Replace simple text with spinner/loading animation
- Show skeleton loaders for better perceived performance

### 9. Additional UX Improvements

- Show closure counts per county
- Highlight fully closed ISDs
- Add "Last checked" timestamps for individual schools (if available)
- Better empty states when no schools match filter/search

## Files to Modify

1. **[src/lib/Closures.svelte](src/lib/Closures.svelte)**: 

- Update API response handling
- Add statistics dashboard
- Add search functionality
- Enhance visual display with badges, collapsible sections
- Improve error handling

2. **[src/routes/+page.svelte](src/routes/+page.svelte)**: 

- Change default `isdFilter` to `'Oakland Schools'`

3. **[src/lib/store.js](src/lib/store.js)**: 

- Potentially add stores for search state, statistics

4. **Styling**: Update component styles for new UI elements

## Implementation Notes

- Maintain backward compatibility during transition
- Use Svelte 5 syntax (already in use)
- Leverage Bootstrap classes already included in app.html
- Ensure mobile-first responsive design
- Preserve existing session storage functionality
- Use conditional requests (ETag) for better performance if needed