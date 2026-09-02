function onFormSubmit(e) {
  sendRegistration_(e.response);
}

function backfillAllResponses() {
  const form = FormApp.getActiveForm();
  form.getResponses().forEach(sendRegistration_);
}

function sendRegistration_(response) {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty('WEBHOOK_URL');
  const secret = props.getProperty('WEBHOOK_SECRET');
  if (!url || !secret) {
    throw new Error('Set WEBHOOK_URL and WEBHOOK_SECRET in Script Properties');
  }

  const mapped = mapItemResponses_(response.getItemResponses());
  const payload = {
    googleResponseId: response.getId(),
    name: mapped.name,
    email: mapped.email,
    dateOfBirth: mapped.dateOfBirth,
    phone: mapped.phone,
    preferredContact: mapped.preferredContact,
    submittedAt: response.getTimestamp() ? response.getTimestamp().toISOString() : new Date().toISOString(),
  };

  if (mapped.photoFileId) {
    try {
      const file = DriveApp.getFileById(mapped.photoFileId);
      const blob = file.getBlob();
      payload.photoMimeType = blob.getContentType();
      payload.photoBase64 = Utilities.base64Encode(blob.getBytes());
    } catch (err) {
      console.error('Photo read failed', err);
    }
  }

  UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: 'Bearer ' + secret },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true,
  });
}

function mapItemResponses_(itemResponses) {
  const mapped = {
    name: '',
    email: '',
    dateOfBirth: '',
    phone: '',
    preferredContact: 'phone',
    photoFileId: '',
  };

  itemResponses.forEach(function (itemResponse) {
    const title = String(itemResponse.getItem().getTitle() || '').toLowerCase();
    const answer = itemResponse.getResponse();
    if (looksLike_(title, ['emër', 'emer', 'name', 'mbiemër', 'mbiemer', 'surname'])) {
      mapped.name = stringifyAnswer_(answer);
    } else if (looksLike_(title, ['email', 'e-mail', 'postë', 'poste'])) {
      mapped.email = stringifyAnswer_(answer);
    } else if (looksLike_(title, ['datelind', 'lind', 'birth'])) {
      mapped.dateOfBirth = stringifyAnswer_(answer);
    } else if (looksLike_(title, ['telefon', 'phone', 'cel'])) {
      mapped.phone = stringifyAnswer_(answer);
    } else if (looksLike_(title, ['kontakt', 'contact', 'prefer'])) {
      mapped.preferredContact = stringifyAnswer_(answer);
    } else if (looksLike_(title, ['foto', 'photo', 'image', 'personal'])) {
      if (Array.isArray(answer) && answer.length) mapped.photoFileId = String(answer[0]);
      else if (typeof answer === 'string' && answer) mapped.photoFileId = answer;
    }
  });

  return mapped;
}

function looksLike_(title, keys) {
  return keys.some(function (key) {
    return title.indexOf(key) !== -1;
  });
}

function stringifyAnswer_(answer) {
  if (answer == null) return '';
  if (Array.isArray(answer)) return answer.filter(Boolean).join(' ').trim();
  return String(answer).trim();
}
