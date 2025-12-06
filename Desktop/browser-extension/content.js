(function() {
  'use strict';

  let isRecording = false;
  let eventQueue = [];
  let elementIndex = 0;
  const elementMap = new WeakMap();

  // Generate multiple selector strategies for an element
  function generateSelectors(element) {
    const selectors = {
      id: null,
      cssSelector: null,
      xpath: null,
      dataTestId: null,
      name: null,
      className: null,
      tagName: element.tagName.toLowerCase(),
      text: element.textContent?.trim().substring(0, 50) || null
    };

    // ID selector
    if (element.id) {
      selectors.id = `#${element.id}`;
    }

    // Data-testid selector (common testing attribute)
    const dataTestId = element.getAttribute('data-testid') ||
                      element.getAttribute('data-test') ||
                      element.getAttribute('data-test-id');
    if (dataTestId) {
      selectors.dataTestId = `[data-testid="${dataTestId}"]`;
    }

    // Name attribute
    if (element.name) {
      selectors.name = `[name="${element.name}"]`;
    }

    // Class name (first two classes)
    if (element.className && typeof element.className === 'string') {
      const classes = element.className.split(' ').filter(c => c.length > 0);
      if (classes.length > 0) {
        selectors.className = `.${classes.slice(0, 2).join('.')}`;
      }
    }

    // Generate CSS selector path
    function getCssPath(el) {
      if (!(el instanceof Element)) return null;

      const path = [];
      while (el.nodeType === Node.ELEMENT_NODE) {
        let selector = el.nodeName.toLowerCase();

        if (el.id) {
          selector += `#${el.id}`;
          path.unshift(selector);
          break;
        } else {
          let sibling = el;
          let nth = 1;
          while (sibling = sibling.previousElementSibling) {
            if (sibling.nodeName.toLowerCase() === selector) nth++;
          }
          if (nth !== 1) selector += `:nth-of-type(${nth})`;
        }

        path.unshift(selector);
        el = el.parentNode;
      }
      return path.join(' > ');
    }
    selectors.cssSelector = getCssPath(element);

    // Generate XPath
    function getXPath(el) {
      if (!(el instanceof Element)) return null;

      const path = [];
      while (el.nodeType === Node.ELEMENT_NODE) {
        let index = 0;
        let sibling = el.previousSibling;

        while (sibling) {
          if (sibling.nodeType === Node.ELEMENT_NODE && sibling.nodeName === el.nodeName) {
            index++;
          }
          sibling = sibling.previousSibling;
        }

        const tagName = el.nodeName.toLowerCase();
        const pathIndex = index > 0 ? `[${index + 1}]` : '';
        path.unshift(`${tagName}${pathIndex}`);

        el = el.parentNode;
      }

      return path.length ? `/${path.join('/')}` : null;
    }
    selectors.xpath = getXPath(element);

    return selectors;
  }

  // Get element attributes
  function getElementAttributes(element) {
    const attrs = {};
    for (let attr of element.attributes) {
      attrs[attr.name] = attr.value;
    }
    return attrs;
  }

  // Send event to background script
  function sendEvent(event) {
    if (isRecording) {
      chrome.runtime.sendMessage({
        type: 'RECORD_EVENT',
        event: event
      });
    }
  }

  // Handle click events
  function handleClick(event) {
    if (!isRecording) return;

    const element = event.target;
    const selectors = generateSelectors(element);

    const clickEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      eventType: 'Click',
      target: {
        selectors: selectors,
        tagName: selectors.tagName,
        text: selectors.text,
        attributes: getElementAttributes(element)
      },
      data: {
        button: event.button === 0 ? 'left' : event.button === 2 ? 'right' : 'middle',
        modifiers: []
      },
      coordinates: {
        x: event.clientX,
        y: event.clientY
      }
    };

    // Add modifier keys
    if (event.ctrlKey) clickEvent.data.modifiers.push('ctrl');
    if (event.shiftKey) clickEvent.data.modifiers.push('shift');
    if (event.altKey) clickEvent.data.modifiers.push('alt');
    if (event.metaKey) clickEvent.data.modifiers.push('meta');

    sendEvent(clickEvent);
  }

  // Handle input events
  function handleInput(event) {
    if (!isRecording) return;

    const element = event.target;
    const selectors = generateSelectors(element);

    const inputEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      eventType: 'Input',
      target: {
        selectors: selectors,
        tagName: selectors.tagName,
        text: selectors.text,
        attributes: getElementAttributes(element)
      },
      data: {
        value: element.value,
        inputType: element.type || 'text'
      }
    };

    sendEvent(inputEvent);
  }

  // Handle navigation events
  function handleNavigation() {
    if (!isRecording) return;

    const navigationEvent = {
      id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      eventType: 'Navigate',
      target: {
        url: window.location.href
      },
      data: {
        url: window.location.href,
        title: document.title
      }
    };

    sendEvent(navigationEvent);
  }

  // Handle scroll events (throttled)
  let scrollTimeout;
  function handleScroll() {
    if (!isRecording) return;

    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      const scrollEvent = {
        id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toISOString(),
        eventType: 'Scroll',
        target: {
          url: window.location.href
        },
        data: {
          x: window.pageXOffset || document.documentElement.scrollLeft,
          y: window.pageYOffset || document.documentElement.scrollTop
        }
      };

      sendEvent(scrollEvent);
    }, 100);
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'START_RECORDING') {
      isRecording = true;
      sendResponse({ status: 'recording_started' });
    } else if (message.type === 'STOP_RECORDING') {
      isRecording = false;
      sendResponse({ status: 'recording_stopped' });
    } else if (message.type === 'GET_RECORDING_STATE') {
      sendResponse({ isRecording: isRecording });
    }
  });

  // Add event listeners
  document.addEventListener('click', handleClick, true);
  document.addEventListener('input', handleInput, true);
  document.addEventListener('change', handleInput, true);
  window.addEventListener('scroll', handleScroll, { passive: true });

  // Listen for navigation
  window.addEventListener('beforeunload', handleNavigation);

  // Initial navigation event for page load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', handleNavigation);
  } else {
    handleNavigation();
  }

  // Highlight elements on hover when recording
  function handleMouseOver(event) {
    if (!isRecording) return;

    const element = event.target;
    element.style.outline = '2px solid #ff4444';
    element.style.outlineOffset = '2px';
  }

  function handleMouseOut(event) {
    if (!isRecording) return;

    const element = event.target;
    element.style.outline = '';
    element.style.outlineOffset = '';
  }

  document.addEventListener('mouseover', handleMouseOver, true);
  document.addEventListener('mouseout', handleMouseOut, true);

  console.log('UITrace Recorder: Content script loaded');
})();