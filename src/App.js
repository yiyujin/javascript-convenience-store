import { Console, DateTimes } from "@woowacourse/mission-utils";

class App {
    constructor() {
        this.products = [
            { name: "콜라", price: 1000, quantity: 10, promotion: "탄산2+1" },
            { name: "콜라", price: 1000, quantity: 10, promotion: null },
            { name: "사이다", price: 1000, quantity: 8, promotion: "탄산2+1" },
            { name: "사이다", price: 1000, quantity: 7, promotion: null },
            { name: "오렌지주스", price: 1800, quantity: 9, promotion: "MD추천상품" },
            { name: "오렌지주스", price: 1800, quantity: 0 },
            { name: "탄산수", price: 1200, quantity: 5, promotion: "탄산2+1" },
            { name: "물", price: 500, quantity: 10, promotion: null },
            { name: "비타민워터", price: 1500, quantity: 6, promotion: null },
            { name: "감자칩", price: 1500, quantity: 5, promotion: "반짝할인" },
            { name: "초코바", price: 1200, quantity: 5, promotion: "MD추천상품" },
            { name: "초코바", price: 1200, quantity: 5, promotion: null },
            { name: "에너지바", price: 2000, quantity: 5, promotion: null },
            { name: "정식도시락", price: 6400, quantity: 8, promotion: null },
            { name: "컵라면", price: 1700, quantity: 1, promotion: "MD추천상품" },
            { name: "컵라면", price: 1700, quantity: 10, promotion: null }
        ];

        this.promotions = [
            { name: "탄산2+1", buy: 2, get: 1, start_date: "2024-01-01", end_date: "2024-12-31" },
            { name: "MD추천상품", buy: 1, get: 1, start_date: "2024-01-01", end_date: "2024-12-31" },
            { name: "반짝할인", buy: 1, get: 1, start_date: "2024-11-01", end_date: "2024-11-30" }
        ];

        this.cart = [];
        this.freeItems = [];
    }

    async run() {
        let continueShoping = true;
        while (continueShoping) {
            try {
                await this.showProducts();
                await this.updateDB();
                const membershipApplied = await this.askForMembership();
                const receipt = await this.applyPromotion(membershipApplied);
                await this.printReceipt(receipt);
                continueShoping = await this.askForContinue();
            } catch (error) {
                Console.print(error.message);
            }
        }
    }

    async showProducts() {
        Console.print("안녕하세요. W편의점입니다.\n현재 보유하고 있는 상품입니다.");
        
        this.products.forEach(product => {
            const promotionText = product.promotion ? ` ${product.promotion}` : '';
            const quantityText = product.quantity > 0 ? `${product.quantity}개` : '재고 없음';
            Console.print(`- ${product.name} ${product.price.toLocaleString()}원 ${quantityText}${promotionText}`);
        });
    }

    async updateDB() {
        const input = await Console.readLineAsync("\n구매하실 상품명과 수량을 입력해 주세요. (예: [사이다-2],[감자칩-1])\n");
        
        this.cart = [];
        this.freeItems = [];

        const items = input.split(",").map(item => item.replace(/[\[\]]/g, '').trim());

        for (const item of items) {
            const [name, quantity] = item.split("-").map(part => part.trim());
            const productVariants = this.products.filter(p => p.name === name);

            if (productVariants.length === 0) {
                throw new Error(`[ERROR] 상품 "${name}"을 찾을 수 없습니다.`);
            }

            const totalStock = productVariants.reduce((sum, p) => sum + p.quantity, 0);
            const quantityNum = parseInt(quantity, 10);

            if (isNaN(quantityNum) || quantityNum <= 0) {
                throw new Error(`[ERROR] 수량 "${quantity}"은 유효하지 않습니다.`);
            }

            if (quantityNum > totalStock) {
                throw new Error(`[ERROR] 상품 "${name}"의 재고가 부족합니다. 최대 ${totalStock}개까지만 구매할 수 있습니다.`);
            }

            this.cart.push({ name, quantity: quantityNum });
        }
    }

    async askForMembership() {
        const answer = await Console.readLineAsync("멤버십 할인을 받으시겠습니까? (Y/N)\n");
        return answer.toUpperCase() === 'Y';
    }

    async askForContinue() {
        const answer = await Console.readLineAsync("감사합니다. 구매하고 싶은 다른 상품이 있나요? (Y/N)\n");
        return answer.toUpperCase() === 'Y';
    }

    async applyPromotion(isMember) {
        const today = new Date(DateTimes.now());
        let totalPrice = 0;
        let totalDiscount = 0;
        let membershipDiscount = 0;
        this.freeItems = [];

        // Process each item in the cart
        for (const cartItem of this.cart) {
            const productVariants = this.products.filter(p => p.name === cartItem.name);
            const applicablePromos = productVariants
                .map(variant => variant.promotion)
                .filter(promoName => {
                    if (!promoName) return false;
                    const promo = this.promotions.find(p => p.name === promoName);
                    if (!promo) return false;
                    
                    const startDate = new Date(promo.start_date);
                    const endDate = new Date(promo.end_date);
                    return today >= startDate && today <= endDate;
                });

            if (applicablePromos.length === 0) {
                const regularProduct = productVariants.find(p => !p.promotion);
                totalPrice += regularProduct.price * cartItem.quantity;
                regularProduct.quantity -= cartItem.quantity;
                continue;
            }

            const promoName = applicablePromos[0];
            const promotion = this.promotions.find(p => p.name === promoName);
            const promoProduct = productVariants.find(p => p.promotion === promoName);
            const regularProduct = productVariants.find(p => !p.promotion);

            const sets = Math.floor(cartItem.quantity / (promotion.buy + promotion.get));
            const remainingItems = cartItem.quantity % (promotion.buy + promotion.get);

            if (remainingItems > 0 && remainingItems === promotion.buy) {
                const answer = await Console.readLineAsync(
                    `현재 ${cartItem.name}은(는) ${promotion.get}개를 무료로 더 받을 수 있습니다. 추가하시겠습니까? (Y/N)\n`
                );
                if (answer.toUpperCase() === 'Y') {
                    cartItem.quantity += promotion.get;
                }
            }

            let promoSetsAvailable = Math.floor(promoProduct.quantity / (promotion.buy + promotion.get));
            let setsUsingPromoStock = Math.min(sets, promoSetsAvailable);
            let setsUsingRegularStock = sets - setsUsingPromoStock;

            if (setsUsingRegularStock > 0) {
                const answer = await Console.readLineAsync(
                    `현재 ${cartItem.name} ${setsUsingRegularStock * (promotion.buy + promotion.get)}개는 프로모션 할인이 적용되지 않습니다. 그래도 구매하시겠습니까? (Y/N)\n`
                );
                if (answer.toUpperCase() !== 'Y') {
                    throw new Error("구매가 취소되었습니다.");
                }
            }

            // Calculate price and discounts
            const promoItems = setsUsingPromoStock * (promotion.buy + promotion.get);
            const regularItems = (setsUsingRegularStock * (promotion.buy + promotion.get)) + remainingItems;

            // totalPrice += promoProduct.price * (promoItems - setsUsingPromoStock);
            totalPrice += regularProduct.price * regularItems;
            
            totalDiscount += promoProduct.price * setsUsingPromoStock;
            
            // Add free items
            this.freeItems.push({
                name: cartItem.name,
                quantity: setsUsingPromoStock
            });

            // Update stock
            promoProduct.quantity -= promoItems;
            if (regularItems > 0) {
                regularProduct.quantity -= regularItems;
            }
        }

        // Apply membership discount
        if (isMember) {
            const regularPrice = totalPrice - totalDiscount;
            membershipDiscount = Math.min(regularPrice * 0.3, 8000);
        }

        return {
            items: this.cart,
            freeItems: this.freeItems,
            totalPrice,
            totalDiscount,
            membershipDiscount,
            finalPrice: totalPrice - totalDiscount - membershipDiscount
        };
    }

    async printReceipt(receipt) {
        Console.print("==============W 편의점================");
        Console.print("상품명\t\t수량\t금액");
        
        receipt.items.forEach(item => {
            const product = this.products.find(p => p.name === item.name);
            Console.print(`${item.name}\t\t${item.quantity}\t${(product.price * item.quantity).toLocaleString()}`);
        });

        if (receipt.freeItems.length > 0) {
            Console.print("=============증\t정===============");
            receipt.freeItems.forEach(item => {
                Console.print(`${item.name}\t\t${item.quantity}`);
            });
        }

        Console.print("====================================");
        Console.print(`총구매액\t\t${receipt.items.reduce((sum, item) => sum + item.quantity, 0)}\t${receipt.totalPrice.toLocaleString()}`);
        Console.print(`행사할인\t\t\t-${receipt.totalDiscount.toLocaleString()}`);
        Console.print(`멤버십할인\t\t\t-${receipt.membershipDiscount.toLocaleString()}`);
        Console.print(`내실돈\t\t\t ${receipt.finalPrice.toLocaleString()}`);
    }
}

export default App;