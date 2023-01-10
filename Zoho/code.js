const { code, clientId, clientSecret, timeout, zone } = self.setup;

// ============Constant============

const OAUTH_HOST = (zone == 0 ? "accounts.zoho.com.cn" : "accounts.zoho.com");
const DESK_HOST = (zone == 0 ? "desk.zoho.com.cn" : "desk.zoho.com");

// ===============================

const refreshToken = await self.storage.get("refresh_token");

// Update token
const setToken = async (result) => {
  const dueTime = new Date().getTime() + (result.expires_in - 60) * 1000; //提前60秒到期
  await self.storage.set("access_token", result.access_token);
  await self.storage.set("refresh_token", result.refresh_token);
  await self.storage.set("due_time", dueTime);
  await self.storage.del("department_id");
  system.printf("authorization completed，token expiration time: ", dueTime);

  await getDefaultDepartmentId(result.access_token);
};

// Empty token
const delToken = async () => {
  await self.storage.del("access_token");
  await self.storage.del("refresh_token");
  await self.storage.del("due_time");
};

// Authorization
const authorization = async () => {

  if (refreshToken != null) {
    system.printf("You have authorize this application");
    return;
  }
  let url = `https://${OAUTH_HOST}/oauth/v2/token?code=%s&grant_type=authorization_code&client_id=%s&client_secret=%s&access_type=offline`;
  url = await untils.format(url, code, clientId, clientSecret);

  const { err, res } = await http.send("post", url, { timeout });
  if (err) {
    system.printf("authorization Error -1", err);
    return;
  }

  if (res.data.error || !res.data.access_token || res.status != 200) {
    system.printf("authorization Error -2", err);
    system.printf(res.data);
    return;
  }

  await setToken(res.data);
};

// Check token expiration
const checkToken = async () => {
  const dueTime = await self.storage.get("due_time");
  if (dueTime == null) return -1;
  const time = dueTime - new Date().getTime();
  if (time > 0) {
    system.printf(`time to expiration ${time}`);
    return 1;
  }


  system.printf("Authentication token expired，refreshing token··")
  let url = `https://${OAUTH_HOST}/oauth/v2/token?refresh_token=%s&client_id=%s&client_secret=%s&grant_type=refresh_token`;
  url = await untils.format(url, refreshToken, clientId, clientSecret);

  const { err, res } = await http.send("post", url, { timeout });
  if (err) {
    system.printf("checkToken Error -1", err);
    return -2;
  }

  if (res.data.error || !res.data.access_token || res.status != 200) {
    system.printf("checkToken Error -2", err);
    system.printf(res.data);
    return -3;
  }
  await setToken(res.data);
  return 0;

};

// Get the default department ID
const getDefaultDepartmentId = async (accessToken) => {
  const url = `https://${DESK_HOST}/api/v1/departments`;
  const { err, res } = await http.send("get", url, {
    timeout, headers:
    {
      "Authorization": `Bearer ${accessToken}`,
    }
  });
  if (err) {
    system.printf("getDefaultDepartmentId Error -1", err);
    return;
  }

  if (res.data.error || !res.data.data || res.status != 200) {
    system.printf("getDefaultDepartmentId Error -2", err);
    system.printf(res.data);
    return;
  }


  const department = res.data.data.find(department => {
    return department.isDefault == true;
  })

  if (department) {
    await self.storage.set("department_id", department.id);
    system.printf("get department info successfully");
    return true;
  }

  system.printf("get department info failed!");
  return false;
};

// Switching priority
const getZohoPriorityByEasiioIssue = () => {
  switch (self.issue.priority) {
    case '5':
      return "Highest";
    case '4':
      return "High";
    case '3':
      return "Medium";
    case '2':
      return "Low";
    case '1':
      return "Lowest";
    default:
      return "Medium";
  }
};

const createTicket = async (accessToken, departmentId) => {
  const url = `https://${DESK_HOST}/api/v1/tickets`;
  const { reporter } = self.issue;
  const body = {
    "subject": self.issue.title,
    "departmentId": departmentId,
    "contact": {
      "lastName": reporter.name,
      "email": reporter.email,
      "phone": `${reporter.countryCode} ${reporter.mobilephone}`,
    },
    "channel": "Easiio",
    "description": self.issue.description,
    "email": reporter.email,
    "phone": `${reporter.countryCode} ${reporter.mobilephone}`,
    "priority": getZohoPriorityByEasiioIssue(),
    "dueDate": self.issue.dueDate,
  };

  const { err, res } = await http.send("post", url, {
    timeout,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
    data: body
  });
  if (err) {
    system.printf("createTicket Error -1", err);
    return;
  }

  if (res.data.error || !res.data.id || res.status != 200) {
    system.printf("createTicket Error -2", err);
    system.printf(res.data);
    return;
  }

  system.printf("createTicket ID:%s", res.data.id);
  await self.issue.set("zoho_id", res.data.id);
};


const updateTicket = async (accessToken) => {
  const ticketId = await self.issue.get("zoho_id");
  if (ticketId == null) {
    system.printf(`Not Found ZoHo TicketId  IssueID:${self.issue.id}`);
    return;
  }
  const url = `https://${DESK_HOST}/api/v1/tickets/${ticketId}`;
  const { reporter } = self.issue;
  const body = {
    "subject": self.issue.title,
    "description": self.issue.description,
    "email": reporter.email,
    "priority": getZohoPriorityByEasiioIssue(),
    "dueDate": self.issue.dueDate,
  };

  const { err, res } = await http.send("patch", url, {
    timeout,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
    data: body
  });
  if (err) {
    system.printf("updateTicket Error -1", err);
    return;
  }

  if (res.data.error || !res.data.id || res.status != 200) {
    system.printf("updateTicket Error -2", err);
    system.printf(res.data);
    return;
  }

  system.printf("updateTicket ID:%s", res.data.id);
}

const deleteTicket = async (accessToken) => {
  const ticketId = await self.issue.get("zoho_id");
  if (ticketId == null) {
    system.printf(`Not Found ZoHo TicketId  IssueID:${self.issue.id}`);
    return;
  }
  const url = `https://${DESK_HOST}/api/v1/tickets/moveToTrash`;
  const body = {
    "ticketIds": [
      ticketId
    ]
  };

  const { err, res } = await http.send("post", url, {
    timeout,
    headers: {
      "Authorization": `Bearer ${accessToken}`,
    },
    data: body
  });
  if (err) {
    system.printf("deleteTicket Error -1", err);
    return;
  }

  if (res.data.error || res.status != 204) {
    system.printf("deleteTicket Error -2", err);
    system.printf(res.data);
    return;
  }

  system.printf("deleteTicket success");
};



// Entry function
const main = async () => {
  if ((self.action != IssueAction.call && self.action != IssueAction.test) && refreshToken == null) {
    system.printf("Please authenticate application first!");
    return;
  }

  // Check token expiration
  if (refreshToken != null) {
    const checkStatus = await checkToken();
    system.printf(`checkStatus:${checkStatus}`)
    if (checkStatus < 0)
      return;

  }

  const accessToken = await self.storage.get("access_token");

  // Check department ID
  if (accessToken && !(await self.storage.has("department_id")))
    if (!await getDefaultDepartmentId(accessToken))
      return;

  const departmentId = await self.storage.get("department_id")



  switch (self.action) {
    case IssueAction.create:
      await createTicket(accessToken, departmentId);
      break;
    case IssueAction.update:
      await updateTicket(accessToken);
      break;
    case IssueAction.softDelete:
      await deleteTicket(accessToken);
      break;
    case IssueAction.hardDelete:
      break;
    case IssueAction.test:
      break;
    case IssueAction.call:
      await authorization();
      break;
    case IssueAction.column:
      system.printf("This App do not support manual operation");
      break;
  }

};

// Is currently in async function
return await main();