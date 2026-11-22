# CampusTrade UTM Security Specification

## 1. Data Invariants

1. **PII Isolation**: Private user profile documents (`/users/{userId}`) containing `email`, `phone`, `college`, and `dormAddress` may only be read or written by the authenticated user matching `userId`.
2. **Seller Ownership & Immutability**: Only the authenticated creator (`sellerId == request.auth.uid`) can create, edit metadata of, or delete an `available` listing. `sellerId` and `createdAt` are immutable after creation.
3. **Atomic Reservation Lock**: A buyer cannot reserve their own listing (`sellerId != request.auth.uid`), cannot reserve an already reserved/sold listing, and reserving a listing MUST atomically update `/listings/{listingId}` (`status = 'reserved'`, `reservedBy = request.auth.uid`) and create `/reservations/{listingId}` (`status = 'pending'`) in the same Firestore transaction.
4. **Handover Negotiation State Machine**:
   - Only the `sellerId` may transition `pending` or `buyer_counter_proposed` -> `seller_proposed` with valid handover fields.
   - Only the `buyerId` may transition `seller_proposed` -> `buyer_counter_proposed` with valid handover fields.
   - Only the `buyerId` may accept `seller_proposed` -> `confirmed`, and only the `sellerId` may accept `buyer_counter_proposed` -> `confirmed`.
   - `confirmed` is a terminal state for reservations; no further updates or deletions are permitted.
5. **Private Chat Master Gate**: Subcollection `/reservations/{reservationId}/messages/{messageId}` strictly validates membership against the parent `/reservations/{reservationId}` document (`buyerId == request.auth.uid || sellerId == request.auth.uid`). Messages are append-only (`update` and `delete` forbidden).
6. **Temporal & Volumetric Bounds**: Every string field enforces `.size()` limits, every ID path variable enforces `isValidId()`, and `createdAt` / `updatedAt` must equal `request.time`.

## 2. The "Dirty Dozen" Attack Payloads (All Must Fail with PERMISSION_DENIED)

1. **Read Private Profile of Another User**: `GET /users/victimUid` as `attackerUid` -> DENIED.
2. **Shadow Field Injection on Profile**: `CREATE /users/attackerUid` with extra field `isAdmin: true` -> DENIED.
3. **Spoof Seller on Listing Creation**: `CREATE /listings/fake1` with `sellerId: "victimUid"` as `attackerUid` -> DENIED.
4. **Create Listing Already Reserved/Sold**: `CREATE /listings/fake2` with `status: "sold"` -> DENIED.
5. **Shadow Update on Listing**: `UPDATE /listings/item1` by seller adding `sellerVerifiedUtm: true` or `reservedBy: "anyone"` -> DENIED.
6. **Self-Reservation Exploit**: `UPDATE /listings/item1` by `sellerId` to `status: "reserved"` -> DENIED.
7. **Orphaned Reservation Without Listing Lock**: `CREATE /reservations/item1` without updating `/listings/item1` in the same transaction -> DENIED.
8. **Buyer Hijacking Seller Handover Step**: `UPDATE /reservations/item1` by `buyerId` setting `status: "seller_proposed"` when `status == "pending"` -> DENIED.
9. **Terminal State Bypass**: `UPDATE /reservations/item1` when `status == "confirmed"` -> DENIED.
10. **Coordinate Poisoning on Handover**: `UPDATE /reservations/item1` with `handoverLat: 999` or 500-char `handoverLocation` -> DENIED.
11. **Eavesdrop on Third-Party Chat**: `LIST /reservations/item1/messages` as `outsiderUid` -> DENIED.
12. **Chat Message Spoofing / Tampering**: `CREATE /reservations/item1/messages/m1` with `senderId: "otherUid"` or `UPDATE` on existing message -> DENIED.
