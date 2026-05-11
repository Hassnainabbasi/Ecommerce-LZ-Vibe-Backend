# Bulk import API — frontend ke liye (Roman Urdu)

Ye doc **admin panel / frontend** team ke liye hai: **categories** aur **products** ka bulk import API se kaise call karna hai. Samjhaane wala hissa Roman Urdu mein hai; URLs, field names aur JSON waise hi English mein hain taake copy-paste seedha chale.

## Base URL

Jahan backend chal raha ho, wahan se URL banao:

- Local example: `http://localhost:<PORT>`  
  Port apne `server.js` ya `.env` se dekh lena.

Neeche jo `{BASE}` likha hai, wahan apna asli base URL daalna.

## Auth (zaroori)

Dono endpoints **sirf admin** ke liye hain (`verifyAdmin`).

Token bhejne ka **ek hi** tareeqa kaafi hai:

1. **Cookie:** admin login ke baad jo `adminToken` cookie set hoti hai — agar tumhari app same setup use karti ho to request ke saath `credentials: "include"` lagao, cookie khud chali jayegi.
2. **Header:** `Authorization: Bearer <JWT>`

JWT ke andar `isAdmin: true` hona chahiye; warna `403` milega.

### Fetch example (cookie wala flow — server pe CORS `credentials: true` hai)

```js
const res = await fetch(`${BASE}/api/categories/bulk-import`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  credentials: "include",
  body: JSON.stringify({ categories: [/* ... */] }),
});
```

Agar Bearer header use kar rahe ho:

```js
headers: {
  "Content-Type": "application/json",
  Authorization: `Bearer ${adminJwt}`,
},
```

Aam errors: `401` token galat / expire, `403` token nahi mila ya admin nahi.

---

## 1) Categories bulk import

| Cheez | Value |
|--------|--------|
| Method | `POST` |
| URL | `{BASE}/api/categories/bulk-import` |
| Body | JSON |

### Body format (dono theek hain)

- `{ "categories": [ { ... }, ... ] }` — **ye zyada clear hai**
- Ya seedha array: `[ { ... }, ... ]`

### Har category object mein kya bhejo

| Field | Zaroori? | Baat |
|--------|----------|------|
| `name` | Haan | string; server khud lowercase + trim karta hai |
| `description` | Nahi | string; agar na ho to `""` |
| `image` | Nahi | Remote URL ya base64 — Cloudinary pe upload ho kar **secure URL** DB mein jati hai. Na ho to `""`. Tumhari Cloudinary pe pehle se hosted URL ho to skip re-upload |
| `isActive` | Nahi | boolean; default `true` |

### Limit

- Ek request mein **zyada se zyada 500** rows
- Agar array khali ho to `400` error

### Response `201` (structure)

```json
{
  "success": true,
  "message": "Bulk import completed",
  "summary": {
    "total": 10,
    "inserted": 8,
    "skipped": 2,
    "errors": 0
  },
  "inserted": [ /* jo save huin categories */ ],
  "skipped": [
    { "index": 3, "name": "protein", "reason": "already exists" }
  ],
  "errors": []
}
```

- **skipped:** pehle se DB mein same naam hai, ya payload mein do dafa same naam
- **errors:** maslan `name` hi nahi diya

### Chhota example

```json
{
  "categories": [
    { "name": "Protein", "description": "Protein supplements", "isActive": true },
    { "name": "Creatine" }
  ]
}
```

---

## 2) Products bulk import

| Cheez | Value |
|--------|--------|
| Method | `POST` |
| URL | `{BASE}/products/bulk-import` |
| Body | JSON |

### Body format

- `{ "products": [ { ... }, ... ] }` — **preferred**
- Ya seedha array: `[ { ... }, ... ]`

### Har product object

| Field | Zaroori? | Baat |
|--------|----------|------|
| `name` | Haan | string |
| `category` | Haan | string; server **lowercase + trim** karta hai; ye naam **database mein active category** ke `name` se match hona chahiye |
| `price` | Haan | number, 0 se bara |
| `weight` | Nahi | string |
| `flavor` | Nahi | string (comma se flavours alag), ya string array, ya skip → `[]` |
| `image` | Nahi | Remote URL ya base64 — Cloudinary pe upload ho kar **secure URL** DB mein jati hai. Na ho to placeholder `"/images/placeholder.png"` (ye local path hai, upload nahi). Tumhari Cloudinary pe pehle se hosted URL ho to skip re-upload |
| `productId` | Nahi | unique; na do to server khud bana deta hai |

### Zaroori baat: category pehle honi chahiye

Products bulk se pehle woh categories **bani hui aur active** honi chahiye (single create API ya categories bulk se). Warna us row pe error aayegi: `invalid or inactive category`.

### Limit

- Ek request mein **500** se zyada products nahi
- Khali array = `400`

### Response `201`

```json
{
  "success": true,
  "message": "Bulk import completed",
  "summary": {
    "total": 5,
    "inserted": 4,
    "errors": 1
  },
  "inserted": [ /* saved products */ ],
  "errors": [
    { "index": 2, "reason": "invalid or inactive category", "received": "unknown" }
  ]
}
```

### Chhota example

```json
{
  "products": [
    {
      "name": "Whey Protein 2kg",
      "category": "protein",
      "price": 5499,
      "weight": "2 kg",
      "flavor": "chocolate, vanilla"
    }
  ]
}
```

`category` wohi spelling / naam ho jo DB mein **lowercase `name`** ke tor pe save hai (frontend `"Protein"` bhej bhi de to server lowercase kar deta hai, lekin DB mein asal naam `"protein"` hona chahiye warna match nahi hoga).

---

## CORS / cookies (yaad rakhna)

Backend `cors` mein abhi `origin: "http://localhost:5173"` aur `credentials: true` set hai. Agar tumhara frontend doosre port ya domain pe hai to `server.js` mein origin update karwana padega.

---

## Frontend checklist (short)

1. Admin login → phir cookie ya Bearer se calls.
2. Pehle categories bulk (agar zaroorat ho) → `skipped` / `errors` UI pe dikhao.
3. Products bulk → har row ki `category` active list se match karao (dropdown best rehta hai).
4. Dono `POST` pe `Content-Type: application/json` aur body `JSON.stringify(...)`.

---

**File path (repo):** `docs/FRONTEND_BULK_IMPORT_API.md`
