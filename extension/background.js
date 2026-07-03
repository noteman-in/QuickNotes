chrome.runtime.onMessage.addListener(
    (message) => {
  
      if (message.action === "saveText") {
  
        chrome.storage.local.get(
          ["capturedNotes"],
          (data) => {
  
            const notes =
              data.capturedNotes || [];
  
            notes.push({
              id: Date.now(),
              text: message.text
            });
  
            chrome.storage.local.set({
              capturedNotes: notes
            });
          }
        );
      }
    }
  );