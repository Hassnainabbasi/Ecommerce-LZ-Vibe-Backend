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
| `image` | Nahi | Public remote URL ya base64 data URL bhejo — Cloudinary pe upload ho kar **secure URL** DB mein jati hai. Na ho to `""`. `/images/...` jaisa frontend local path mat bhejna. Tumhari Cloudinary pe pehle se hosted URL ho to skip re-upload |
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
| `category` | Haan | string; server **lowercase + trim** karta hai. Agar ye category DB mein ho to product usi naam ke saath save hoga; agar na ho to backend us naam ki active category khud create kar dega |
| `price` | Haan | number, 0 se bara |
| `weight` | Nahi | string |
| `flavor` | Nahi | string (comma se flavours alag), ya string array, ya skip → `[]` |
| `image` | Nahi | Public remote URL ya base64 data URL bhejo — Cloudinary pe upload ho kar **secure URL** DB mein jati hai. Na ho to placeholder `"/images/placeholder.png"`. `/images/...` jaisa frontend local path mat bhejna. Tumhari Cloudinary pe pehle se hosted URL ho to skip re-upload |
| `productId` | Nahi | unique; na do to server khud bana deta hai |

### Category ka behavior

Products bulk mein jo `category` name bhejoge:

- Agar category pehle se DB mein hai, product usi category name ke saath save hoga.
- Agar category DB mein nahi hai, backend us naam ki category auto-create karega (`isActive: true`) aur phir product save karega.

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
    "categoriesCreated": 1,
    "errors": 1
  },
  "inserted": [ /* saved products */ ],
  "createdCategories": [ /* products import ke during jo nayi categories bani */ ],
  "errors": [
    { "index": 2, "reason": "price must be a valid positive number", "received": "-10" }
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

`category` frontend `"Protein"` bhej bhi de to server usay lowercase karke `"protein"` bana deta hai. Agar `"protein"` DB mein nahi hai to nayi category ban jayegi.

---

## CORS / cookies (yaad rakhna)

Backend `cors` mein abhi `origin: "http://localhost:5173"` aur `credentials: true` set hai. Agar tumhara frontend doosre port ya domain pe hai to `server.js` mein origin update karwana padega.

---

## Frontend checklist (short)

1. Admin login → phir cookie ya Bearer se calls.
2. Categories bulk optional hai; products bulk missing categories khud bana dega.
3. Products bulk → response mein `createdCategories` dikha sakte ho taake admin ko pata chale kya naya bana.
4. Dono `POST` pe `Content-Type: application/json` aur body `JSON.stringify(...)`.

---

**File path (repo):** `docs/FRONTEND_BULK_IMPORT_API.md`
