import React from 'react';
import { Button, Form, Stack } from 'react-bootstrap';


const openOptions = () => {
  chrome.runtime.openOptionsPage();
};

const recordAudio = async () => {
  let [tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  await chrome.tabs.sendMessage(tab.id!, { command: "recordAudio" });
}

const reloadExtension = () => {
  chrome.runtime.reload()
};

export default function Popup(): JSX.Element {
  return (
    <div style={{
      width: "300px",
      padding: "8px"
    }}>
      <Stack gap={2}>
        <Button onClick={recordAudio}>
          Test
        </Button>
        <Button onClick={reloadExtension}>
          Reload
        </Button>
        <Button onClick={openOptions}>
          Options
        </Button>
      </Stack>
    </div>
  );
}
