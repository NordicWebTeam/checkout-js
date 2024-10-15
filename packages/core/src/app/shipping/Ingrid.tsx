import {
    Address,
    Cart,
    CheckoutSelectors,
    StoreConfig,
    RequestOptions
} from '@bigcommerce/checkout-sdk';
import { noop } from 'lodash';
import React, { Component, ReactNode } from 'react';

import CheckoutStepStatus from '../checkout/CheckoutStepStatus';

const ingridApiUrl = process.env.API_URL;


export interface IngridProps {
    cart: Cart;
    config: StoreConfig;
    isBillingSameAsShipping: boolean;
    isMultiShippingMode: boolean;
    step: CheckoutStepStatus;
    shouldShowOrderComments: boolean;
    shouldDisableSubmit: boolean;
    onCreateAccount(): void;
    onToggleMultiShipping(): void;
    onReady?(): void;
    onUnhandledError(error: Error): void;
    onSignIn(): void;
    navigateNextStep(isBillingSameAsShipping: boolean): void;
    updateShippingAddress(address: Partial<Address>): Promise<CheckoutSelectors>;
    updateBillingAddress(address: Partial<Address>): Promise<CheckoutSelectors>;
    loadShippingOptions(options?: IngridRequestOptions): Promise<CheckoutSelectors>;
    loadShippingAddressFields(): Promise<CheckoutSelectors>;
    loadBillingAddressFields(): Promise<CheckoutSelectors>;
    reloadShippingForm(): void;
}

declare interface IngridRequestOptions extends RequestOptions {
    /**
     * Control caching behavior of the request. Set this to 'no-cache' to
     * prevent caching.
     */
    cacheControl: 'max-age=0';

    /**
     * Additional headers to include in the request.
     */
    headers?: Record<string, string>;
}

interface ShippingState {
    isInitializing: boolean;
}

class Ingrid extends Component<IngridProps, ShippingState> {
    constructor(props: IngridProps) {
        super(props);
        this.state = {
            isInitializing: true,
        };
    }

    getSiw(): void{
        let cart = this.props.cart;
        const { storeHash } = this.props.config.storeProfile;

        fetch(`${ingridApiUrl}?store=${storeHash}&cart_id=${cart.id}`, {cache: "no-store"})
        .then(response => response.text())
        .then(data => {
            const widgetDiv = document.getElementById('ingrid-widget');
            if (widgetDiv) {
                widgetDiv.innerHTML = data;
                this.replaceScriptNode(document.getElementById("shipwallet-container"));
                let self = this
                var checkExists = setInterval(() => {
                    if (!document.getElementById('ingrid-widget')){
                        clearInterval(checkExists);
                    }
                    let _Sw = (window as any)._sw;
                    if(_Sw) {
                        _Sw(function(api : any){
                            api.on('data_changed', function(m : any,b : any) {
                                if (!b.initial_load && b.shipping_method_changed || b.pickup_location_changed || b.delivery_address_changed || b.payment_method_changed || b.price_changed) {
                                    self.optionUpdated(m);
                                }
                            })
                            api.on('summary_changed', function(summary : any) {
                                if (summary.delivery_address) {
                                    let address = summary.delivery_address;
                                    self.updateAddress(address , true,'shipping');
                                } else if (summary.billing_address) {
                                    let address = summary.billing_address;
                                    self.updateAddress(address , false,'billing');
                                }
                            })
                            clearInterval(checkExists);
                        });
                    }
                }, 2000);
            }
        })
        .catch((err) => {
            console.error('error',err);
        });
    }

    async updateAddress(address: any, billingSameAsShipping: boolean = true, type: string = 'shipping'){
        const promises: Array<Promise<CheckoutSelectors>> = [];
        let addressData = {
            first_name: address.first_name,
            last_name: address.last_name,
            email: address.email,
            phone: address.phone_number,
            address1: address.address_lines[0],
            city: address.city,
            state_or_province_code: address.region,
            postal_code: address.postal_code,
            country_code: address.country
        }
        if(billingSameAsShipping && type == 'shipping'){
            promises.push(this.props.updateShippingAddress(addressData));
            promises.push(this.props.updateBillingAddress(addressData));
        } else if(!billingSameAsShipping && type == 'shipping'){
            promises.push(this.props.updateShippingAddress(addressData));
        } else if(type == 'billing'){
            promises.push(this.props.updateBillingAddress(addressData));
        }
        await Promise.all(promises);
        this.props.reloadShippingForm();
    }

    optionUpdated(option?: unknown){
        const {
            loadShippingOptions
        } = this.props;
        loadShippingOptions();
        if(option){
            //console.log('option',option);
        }
        
    }

    replaceScriptNode(node: any){
        if (!this.isExternalScript(node) && this.isScriptNode(node)) {
          node.parentNode.replaceChild(this.cloneScriptNode(node), node);
        } else {
          var i = 0,
            children = node.childNodes;
          while (i < children.length) {
            this.replaceScriptNode(children[i++]);
          }
        }
        return node;
      }
  
      isScriptNode(node: any)  {
        return node.nodeName === "SCRIPT";
      }
  
      isExternalScript(node: any) {
        return !!node.src && node.src !== "";
      }
  
      cloneScriptNode(node: any) {
        var script = document.createElement("script");
        script.text = node.innerHTML;
        for (var i = node.attributes.length - 1; i >= 0; i--) {
          script.setAttribute(node.attributes[i].name, node.attributes[i].value);
        }
        return script;
      }

    async componentDidMount(): Promise<void> {
        const {
            onReady = noop,
            onUnhandledError = noop,
        } = this.props;

        try {
            onReady();
            this.getSiw();
        } catch (error) {
            onUnhandledError(error);
        } finally {
            this.setState({ isInitializing: false });
        }
    }

    render(): ReactNode {
        return (
            <>
                <div id="ingrid-widget"></div>
                <style >{`
                    #checkoutShippingAddress {
                        .form-fieldset {
                            display: none !important;
                        }
                    }
                    #checkout-shipping-options {
                        display: none !important;
                    }
                `}</style>
            </>
        );
    }
}

export default Ingrid;