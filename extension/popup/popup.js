document
  .getElementById("open")
  .addEventListener("click", () => {

    chrome.tabs.create({
      url: chrome.runtime.getURL(
        "dist/index.html"
      )
    });

    window.close();
  });