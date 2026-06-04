import Orders from "../models/Orders.js";

export const createOrder = async (req, res) => {
  try {
    const orderData = req.body;

    if (!orderData.name || !orderData.email) {
      return res.status(400).json({
        message: "Name and email are required",
      });
    }

    // Compute totalAmount if not provided
    if (
      orderData.totalAmount == null ||
      Number.isNaN(Number(orderData.totalAmount))
    ) {
      let total = 0;
      if (Array.isArray(orderData.cartItems)) {
        for (const item of orderData.cartItems) {
          const price = Number(item.price) || 0;
          const count = Number(item.count) || 0;
          total += price * count;
        }
      }
      orderData.totalAmount = total;
    } else {
      orderData.totalAmount = Number(orderData.totalAmount);
    }

    const newOrder = new Orders(orderData);
    await newOrder.save();

    // ensure createdAt and totalAmount are returned
    const responseData = newOrder.toObject ? newOrder.toObject() : newOrder;

    res.status(201).json({
      message: "Order placed successfully",
      data: responseData,
    });
  } catch (error) {
    res.status(500).json({
      message: "Failed to place order",
      error: error.message,
    });
  }
};
